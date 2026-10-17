"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";

export default function UserChatPage() {
  const params = useParams();
  const userId = params.userId;

  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);

  const [user, setUser] = useState(null);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [connected, setConnected] = useState(false);

  const [leaveRequests, setLeaveRequests] = useState([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");

  const [activeSection, setActiveSection] = useState(null);

  // Load logged-in user
  useEffect(() => {
    const userData = localStorage.getItem("user");

    if (userData) {
      try {
        setUser(JSON.parse(userData));
      } catch (error) {
        console.error("Invalid saved user data:", error);
      }
    }
  }, []);

  // Fetch previously saved messages
  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    const fetchMessages = async () => {
      try {
        const response = await fetch(
          `/api/messages?userId=${encodeURIComponent(userId)}`,
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Failed to fetch messages");
        }

        if (!cancelled) {
          setMessages(
            data.messages
              .filter((msg) => !msg.message?.startsWith("__LEAVE_EVENT__:"))
              .map((msg) => ({
                senderId: msg.senderId,
                message: msg.message,
              })),
          );
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Error fetching messages:", error);
        }
      }
    };

    fetchMessages();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    const loadLeaveRequests = async () => {
      try {
        const response = await fetch(
          `/api/leave-requests?userId=${encodeURIComponent(userId)}`,
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Failed to load requests");
        }

        if (!cancelled) {
          setLeaveRequests(data.requests);
        }
      } catch (error) {
        console.error("Load leave requests error:", error);
      }
    };

    loadLeaveRequests();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const submitLeaveRequest = async () => {
    if (!user || !startDate || !endDate || !reason.trim()) {
      alert("Please fill in all fields");
      return;
    }

    if (startDate > endDate) {
      alert("End date must be on or after start date");
      return;
    }

    try {
      const response = await fetch("/api/leave-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          userName: user.name,
          startDate,
          endDate,
          reason: reason.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.message || "Failed to submit request");
        return;
      }

      setLeaveRequests((prev) => [data.request, ...prev]);

      // Notify Admin through the existing WebSocket.
      const socket = socketRef.current;

      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(
          JSON.stringify({
            type: "message",
            receiverIds: ["Admin"],
            message:
              "__LEAVE_EVENT__:" +
              JSON.stringify({
                type: "REQUEST_CREATED",
                requestId: data.request._id,
              }),
          }),
        );
      } else {
        console.warn(
          "Leave request saved, but Admin notification was not sent.",
        );
      }

      setStartDate("");
      setEndDate("");
      setReason("");

      alert("Leave request submitted successfully");
    } catch (error) {
      console.error("Submit leave request error:", error);
      alert("Unable to submit leave request");
    }
  };

  // Connect to the WebSocket server running in Project A
  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    let socket = null;

    // Avoid creating a throwaway connection during
    // React Strict Mode's initial development cleanup.
    const timer = setTimeout(() => {
      if (cancelled) return;

      socket = new WebSocket("ws://localhost:3000/ws");
      socketRef.current = socket;

      socket.onopen = () => {
        if (cancelled) {
          socket.close();
          return;
        }

        console.log("WebSocket connected:", userId);
        setConnected(true);

        // Register this user with the Admin WebSocket server
        socket.send(
          JSON.stringify({
            type: "register",
            userId: userId,
          }),
        );

        console.log("Registered user:", userId);
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === "message") {
            if (data.message?.startsWith("__LEAVE_EVENT__:")) {
              const leaveEvent = JSON.parse(
                data.message.slice("__LEAVE_EVENT__:".length),
              );

              if (leaveEvent.type === "REQUEST_REVIEWED") {
                setLeaveRequests((prev) =>
                  prev.map((item) =>
                    String(item._id) === String(leaveEvent.requestId)
                      ? { ...item, status: leaveEvent.status }
                      : item,
                  ),
                );
              }

              // Internal event: do not display it as a chat message.
              return;
            }

            // Existing normal chat functionality.
            setMessages((prev) => [
              ...prev,
              {
                senderId: data.senderId,
                message: data.message,
              },
            ]);
          }

          if (data.type === "error") {
            console.error("WebSocket server error:", data.message);
          }
        } catch (error) {
          console.error("WebSocket message error:", error);
        }
      };

      socket.onerror = (event) => {
        console.error("User WebSocket connection error:", event);
      };

      socket.onclose = (event) => {
        setConnected(false);
        console.log("WebSocket disconnected:", userId, "code:", event.code);
      };
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);

      if (socket) {
        if (socket.readyState === WebSocket.OPEN) {
          socket.close();
        } else if (socket.readyState === WebSocket.CONNECTING) {
          socket.addEventListener("open", () => socket.close(), { once: true });
        }

        if (socketRef.current === socket) {
          socketRef.current = null;
        }
      }
    };
  }, [userId]);

  // Scroll to the latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages]);

  // Send a message to Admin
  const sendMessage = () => {
    const socket = socketRef.current;

    if (!message.trim()) return;

    if (!socket || socket.readyState !== WebSocket.OPEN) {
      alert("WebSocket is not connected. Please wait.");
      return;
    }

    socket.send(
      JSON.stringify({
        type: "message",
        receiverIds: ["Admin"],
        message: message.trim(),
      }),
    );

    setMessage("");
  };

  return (
    
<div className="min-h-screen bg-gray-50 p-4 sm:p-6">
  <div className="mx-auto max-w-3xl overflow-hidden rounded-xl border border-gray-200 bg-white">

    {/* Header - Same as Admin */}
    <div className="border-b border-gray-200 bg-blue-50 px-5 py-4">
      <h1 className="text-xl font-semibold text-gray-800">
        {user?.name || "User"}
      </h1>
      <p className="mt-1 text-sm text-gray-600">
        User Dashboard
      </p>

      <p
        className={`mt-2 flex items-center gap-2 text-sm ${
          connected ? "text-green-700" : "text-red-600"
        }`}
      >
        <span
          className={`h-2 w-2 rounded-full ${
            connected ? "bg-green-500" : "bg-red-500"
          }`}
        />
        WebSocket: {connected ? "Connected" : "Disconnected"}
      </p>
    </div>

    {/* Chat Section */}
    <section className="p-5">
      <h2 className="text-lg font-semibold text-gray-800">
        Chat with Admin
      </h2>

      <div className="mt-4 h-[250px] overflow-y-auto border border-gray-200 bg-gray-50 p-3 sm:p-4">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-gray-500">
            No messages yet. Start a conversation.
          </div>
        ) : (
          messages.map((msg, index) => {
            const isSender = msg.senderId === userId;

            return (
              <div
                key={index}
                className={`mb-3 flex ${
                  isSender ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 ${
                    isSender
                      ? "bg-blue-600 text-white"
                      : "bg-gray-500 text-white"
                  }`}
                >
                  <p
                    className={`mb-1 text-xs ${
                      isSender ? "text-blue-100" : "text-gray-200"
                    }`}
                  >
                    {isSender ? user?.name || "You" : "Admin"}
                  </p>
                  <p className="break-words text-sm">{msg.message}</p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage();
        }}
      >
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type your message..."
          className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        />

        <button
          type="submit"
          disabled={!connected}
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          Send
        </button>
      </form>
    </section>

    <div className="border-t border-gray-200" />

    
{/* Leave Options */}
<div className="border-t border-gray-200 p-5">
  <h2 className="text-lg font-semibold text-gray-800">
    Leave Management
  </h2>
  <p className="mt-1 text-sm text-gray-500">
    Apply for leave or check your existing requests
  </p>

  {/* Action Buttons */}
  <div className="mt-4 flex flex-wrap gap-3">
    <button
      type="button"
      onClick={() =>
        setActiveSection((prev) =>
          prev === "apply" ? null : "apply"
        )
      }
      className={`rounded-lg px-4 py-2.5 text-sm font-medium ${
        activeSection === "apply"
          ? "bg-blue-700 text-white"
          : "bg-blue-600 text-white hover:bg-blue-700"
      }`}
    >
      {activeSection === "apply" ? "Close Leave Form" : "Apply for Leave"}
    </button>

    <button
      type="button"
      onClick={() =>
        setActiveSection((prev) =>
          prev === "requests" ? null : "requests"
        )
      }
      className={`rounded-lg border px-4 py-2.5 text-sm font-medium ${
        activeSection === "requests"
          ? "bg-blue-700 text-white"
          : "bg-blue-600 text-white hover:bg-blue-700"
      }`}
    >
      {activeSection === "requests"
        ? "Hide My Requests"
        : "My Leave Requests"}
    </button>
  </div>

  {/* Apply for Leave Form */}
  {activeSection === "apply" && (
    <div className="mt-5 border-t border-gray-200 pt-5">
      <h3 className="font-semibold text-gray-800">
        Apply for Leave
      </h3>
      <p className="mt-1 text-sm text-gray-500">
        Enter your leave dates and reason
      </p>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium text-gray-700">
          Start Date
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2.5 font-normal outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </label>

        <label className="text-sm font-medium text-gray-700">
          End Date
          <input
            type="date"
            value={endDate}
            min={startDate || undefined}
            onChange={(e) => setEndDate(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2.5 font-normal outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </label>
      </div>

      <label className="mt-4 block text-sm font-medium text-gray-700">
        Reason for Leave
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Enter your reason..."
          rows={3}
          className="mt-1.5 w-full resize-y rounded-lg border border-gray-300 px-3 py-2.5 font-normal outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        />
      </label>

      <button
        type="button"
        onClick={submitLeaveRequest}
        className="mt-3 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
      >
        Submit Leave Request
      </button>
    </div>
  )}

  {/* My Leave Requests */}
  {activeSection === "requests" && (
    <div className="mt-5 border-t border-gray-200 pt-5">
      <h3 className="font-semibold text-gray-800">
        My Leave Requests
      </h3>
      <p className="mt-1 text-sm text-gray-500">
        Check the status of your requests
      </p>

      {leaveRequests.length === 0 ? (
        <p className="mt-4 rounded-lg bg-gray-50 p-4 text-sm text-gray-500">
          You haven't submitted any leave requests yet.
        </p>
      ) : (
        <div className="mt-3 divide-y divide-gray-200">
          {leaveRequests.map((item) => (
            <div key={item._id} className="py-4 first:pt-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-gray-800">
                  {new Date(item.startDate).toLocaleDateString()} –{" "}
                  {new Date(item.endDate).toLocaleDateString()}
                </p>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    item.status === "Approved"
                      ? "bg-green-50 text-green-700"
                      : item.status === "Rejected"
                      ? "bg-red-50 text-red-700"
                      : "bg-amber-50 text-amber-700"
                  }`}
                >
                  {item.status}
                </span>
              </div>

              <p className="mt-2 text-sm text-gray-600">
                <span className="font-medium text-gray-700">
                  Reason:
                </span>{" "}
                {item.reason}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )}
</div>

  </div>
</div>
  );
}
