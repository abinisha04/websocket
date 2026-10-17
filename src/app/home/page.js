"use client";

import { useEffect, useRef, useState } from "react";

export default function Home() {
  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);

  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [users, setUsers] = useState([]);

  const [leaveRequests, setLeaveRequests] = useState([]);
  const [showLeaveRequests, setShowLeaveRequests] = useState(false);

  const currentUser = "Admin";

  //fetch all users
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        console.log("Fetching users from MongoDB...");

        const response = await fetch("/api/users/get");

        const data = await response.json();

        if (response.ok) {
          console.log("Users list:", data.users);
          setUsers(data.users);
        } else {
          console.error("Failed to fetch users:", data.message);
        }
      } catch (error) {
        console.error("Error while fetching users:", error);
      }
    };

    fetchUsers();
  }, []);

  //fetch all messages(Admin)
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const response = await fetch("/api/messages");

        const data = await response.json();

        if (response.ok) {
          const uniqueMessages = new Map();

          data.messages
            .filter((msg) => !msg.message?.startsWith("__LEAVE_EVENT__:"))
            .forEach((msg) => {
              const key = `${msg.senderId}_${msg.message}`;

              if (!uniqueMessages.has(key)) {
                uniqueMessages.set(key, {
                  senderId: msg.senderId,
                  message: msg.message,
                });
              }
            });

          setMessages(Array.from(uniqueMessages.values()));
        } else {
          console.error("Failed to fetch messages:", data.message);
        }
      } catch (error) {
        console.error("Error while fetching messages:", error);
      }
    };

    fetchMessages();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "auto",
    });
  }, [messages]);

  useEffect(() => {
    let cancelled = false;
    let socket = null;

    // Defer connection setup so Strict Mode's initial
    // cleanup can cancel the first setup.
    const timer = setTimeout(() => {
      if (cancelled) return;

      socket = new WebSocket("ws://localhost:3000/ws");
      socketRef.current = socket;

      socket.onopen = () => {
        if (cancelled) {
          socket.close();
          return;
        }

        console.log("Admin connected");

        socket.send(
          JSON.stringify({
            type: "register",
            userId: currentUser,
          }),
        );
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          console.log("WebSocket response:", data);

          if (
            data.type === "message" &&
            data.message?.startsWith("__LEAVE_EVENT__:")
          ) {
            const leaveEvent = JSON.parse(
              data.message.slice("__LEAVE_EVENT__:".length),
            );

            if (leaveEvent.type === "REQUEST_CREATED") {
              fetchLeaveRequests();
              console.log("New leave request received");
            }

            return;
          }

          if (data.type === "message") {
            setMessages((prev) => [
              ...prev,
              {
                senderId: data.senderId,
                message: data.message,
              },
            ]);
          } else if (data.type === "error") {
            console.error("WebSocket server error:", data.message);
          }
        } catch (error) {
          console.error("Invalid WebSocket message:", error);
        }
      };

      socket.onerror = (event) => {
        console.error("Admin WebSocket error:", event);
      };

      socket.onclose = () => {
        console.log("Admin disconnected");
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
  }, []);

  useEffect(() => {
    fetchLeaveRequests();
  }, []);
  

  const handleUserSelect = (userId) => {
    setSelectedUsers((prev) => {
      if (prev.includes(userId)) {
        return prev.filter((id) => id !== userId);
      }

      return [...prev, userId];
    });
  };

  const handleSelectAll = () => {
    if (selectedUsers.length === users.length) {
      // Deselect all users
      setSelectedUsers([]);
    } else {
      // Select all users
      setSelectedUsers(users.map((user) => user.userId));
    }
  };

  const sendMessage = () => {
    const socket = socketRef.current;

    if (!socket || socket.readyState !== WebSocket.OPEN) {
      console.error("Socket state:", socket?.readyState);
      alert("WebSocket is not connected yet");
      return;
    }

    if (!message.trim()) {
      alert("Enter a message");
      return;
    }
    if (selectedUsers.length === 0) {
      alert("Please select at least one user");
      return;
    }

    socket.send(
      JSON.stringify({
        type: "message",
        receiverIds: selectedUsers,
        message,
      }),
    );

    setMessage("");
  };

  const fetchLeaveRequests = async () => {
    try {
      const response = await fetch("/api/leave-requests");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to load requests");
      }

      setLeaveRequests(data.requests);
    } catch (error) {
      console.error("Load leave requests error:", error);
    }
  };

  const reviewLeaveRequest = async (item, status) => {
    try {
      const response = await fetch(`/api/leave-requests/${item._id}/review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.message || "Failed to review request");
        return;
      }

      // Update Admin UI from the saved API response.
      setLeaveRequests((prev) =>
        prev.map((request) =>
          request._id === item._id ? data.request : request,
        ),
      );

      // Notify the specific User through the existing socket.
      const socket = socketRef.current;

      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(
          JSON.stringify({
            type: "message",
            receiverIds: [item.userId],
            message:
              "__LEAVE_EVENT__:" +
              JSON.stringify({
                type: "REQUEST_REVIEWED",
                requestId: item._id,
                status: data.request.status,
              }),
          }),
        );
      } else {
        console.warn(
          "Review saved, but the User notification could not be sent.",
        );
      }
    } catch (error) {
      console.error("Review leave request error:", error);
      alert("Unable to review leave request");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="mx-auto max-w-3xl overflow-hidden border border-gray-200 bg-white">
        {/* Header */}
        <div className="border-b border-gray-200 bg-blue-50 px-5 py-4">
          <h1 className="text-xl font-semibold text-gray-800">
            Admin Dashboard
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage messages and leave requests
          </p>
        </div>

        {/* Chat Section */}
        <section className="p-5">
          <h2 className="text-lg font-semibold text-gray-800">Admin Chat</h2>
          <p className="mt-1 text-sm text-gray-500">
            Select users and send messages
          </p>

          {/* Users */}
          <div className="mt-4 border border-gray-300 bg-gray-50 p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-medium text-gray-700">
                Select Users
              </h3>

              <button
                type="button"
                onClick={handleSelectAll}
                disabled={users.length === 0}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {users.length > 0 && selectedUsers.length === users.length
                  ? "Deselect All"
                  : "Select All"}
              </button>
            </div>

            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {users.map((user) => (
                <label
                  key={user.userId}
                  className="flex cursor-pointer items-center gap-2 text-sm text-gray-700"
                >
                  <input
                    type="checkbox"
                    checked={selectedUsers.includes(user.userId)}
                    onChange={() => handleUserSelect(user.userId)}
                    className="h-4 w-4 accent-blue-600"
                  />
                  {user.name}
                </label>
              ))}
            </div>
          </div>

          {/* Messages */}
          <div className="mt-4 h-[220px] overflow-y-auto border border-gray-300 bg-gray-50 p-3">
            {messages.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-gray-500">
                No messages yet. Start a conversation.
              </div>
            ) : (
              messages.map((msg, index) => {
                const isSender = msg.senderId === currentUser;

                return (
                  <div
                    key={index}
                    className={`mb-4 flex ${
                      isSender ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[85%] rounded-lg px-3 py-2 ${
                        isSender
                          ? "bg-blue-600 text-white"
                          : "border border-gray-300 bg-gray-500 text-white"
                      }`}
                    >
                      <p
                        className={`mb-1 text-xs ${
                          isSender ? "text-blue-100" : "text-gray-300"
                        }`}
                      >
                        {msg.senderId === "Admin"
                          ? "Admin"
                          : users.find((user) => user.userId === msg.senderId)
                              ?.name || msg.senderId}
                      </p>
                      <p className="break-words text-sm">{msg.message}</p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input */}
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
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              Send
            </button>
          </form>
        </section>

        {/* Divider between sections, not separate outer cards */}
        <div className="border-t border-gray-200" />

        {/* Leave Requests */}

        {/* Leave Requests Dropdown */}
        <section className="border-t border-gray-200">
          <button
            type="button"
            onClick={() => setShowLeaveRequests((prev) => !prev)}
            aria-expanded={showLeaveRequests}
            className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left hover:bg-gray-50"
          >
            <div>
              <h2 className="font-semibold text-gray-800">Leave Requests</h2>
              <p className="mt-1 text-sm text-gray-500">
                View and manage employee requests
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
                {leaveRequests.length}
              </span>

              <span className="text-lg text-gray-500">
                {showLeaveRequests ? "−" : "+"}
              </span>
            </div>
          </button>

          {showLeaveRequests && (
            <div className="px-5 pb-5">
              {leaveRequests.length === 0 ? (
                <p className="rounded-md bg-gray-50 p-4 text-sm text-gray-500">
                  No leave requests yet.
                </p>
              ) : (
                <div className="divide-y divide-gray-200">
                  {leaveRequests.map((item) => (
                    <div key={item._id} className="py-4 first:pt-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <h3 className="font-medium text-gray-800">
                            {item.userName}
                          </h3>
                          <p className="mt-1 text-xs text-gray-500">
                            User ID: {item.userId}
                          </p>
                        </div>

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

                      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-gray-500">From</p>
                          <p className="mt-1 text-gray-800">
                            {new Date(item.startDate).toLocaleDateString()}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-gray-500">To</p>
                          <p className="mt-1 text-gray-800">
                            {new Date(item.endDate).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3">
                        <p className="text-xs text-gray-500">Reason</p>
                        <p className="mt-1 whitespace-pre-wrap break-words text-sm text-gray-800">
                          {item.reason}
                        </p>
                      </div>

                      {item.status === "Pending" && (
                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            onClick={() => reviewLeaveRequest(item, "Approved")}
                            className="rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700"
                          >
                            Approve
                          </button>

                          <button
                            type="button"
                            onClick={() => reviewLeaveRequest(item, "Rejected")}
                            className="rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
