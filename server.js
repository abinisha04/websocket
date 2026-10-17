require("dotenv").config({ path: ".env.local" });

const next = require("next");
const http = require("http");
const WebSocket = require("ws");
const mongoose = require("mongoose");
const Message = require("./src/models/Message").default;

const dev = process.argv[2] !== "production";
const app = next({ dev });  
const handle = app.getRequestHandler();

async function startServer() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("MongoDB connected");

    await app.prepare();

    // One HTTP server for Next.js and WebSocket
    const server = http.createServer((req, res) => {
      handle(req, res);
    });

    const wss = new WebSocket.Server({
      noServer: true,
    });

    const nextUpgradeHandler = app.getUpgradeHandler();

    server.on("upgrade", (request, socket, head) => {
      const pathname = new URL(request.url, "http://localhost").pathname;

      if (pathname === "/ws") {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit("connection", ws, request);
        });
        return;
      }

      // Let Next.js handle its own WebSocket upgrades,
      // including /_next/hmr in development.
      nextUpgradeHandler(request, socket, head);
    });

    // Store connected users
    const clients = new Map();

    wss.on("connection", (socket) => {
      console.log("WebSocket client connected");

      socket.on("message", async (rawMessage) => {
        try {
          const data = JSON.parse(rawMessage.toString());

          console.log("Received:", data);

          // Register user
          if (data.type === "register") {
            if (!data.userId) {
              socket.send(
                JSON.stringify({
                  type: "error",
                  message: "userId is required",
                }),
              );
              return;
            }

            // Remove this socket's old registration, if any
            if (socket.userId && clients.get(socket.userId) === socket) {
              clients.delete(socket.userId);
            }

            // Close an older connection for this same user
            const oldSocket = clients.get(data.userId);
            if (oldSocket && oldSocket !== socket) {
              oldSocket.close();
            }

            clients.set(data.userId, socket);
            socket.userId = data.userId;

            console.log(`${data.userId} registered`);
            return;
          }

          // Send and save message
          if (data.type === "message") {
            const senderId = socket.userId;
            const { receiverIds, message } = data;

            // Use the authenticated connection's registered ID
            if (!senderId) {
              socket.send(
                JSON.stringify({
                  type: "error",
                  message: "Register before sending messages",
                }),
              );
              return;
            }

            if (
              !Array.isArray(receiverIds) ||
              receiverIds.length === 0 ||
              typeof message !== "string" ||
              !message.trim()
            ) {
              socket.send(
                JSON.stringify({
                  type: "error",
                  message: "Valid receivers and message are required",
                }),
              );
              return;
            }

            // Save each receiver's message in MongoDB
            await Promise.all(
              receiverIds.map((receiverId) =>
                Message.create({
                  senderId,
                  receiverId,
                  message,
                }),
              ),
            );

            const payload = JSON.stringify({
              type: "message",
              senderId,
              message,
            });

            // Deliver to connected receivers
            for (const receiverId of receiverIds) {
              const receiverSocket = clients.get(receiverId);

              if (
                receiverSocket &&
                receiverSocket.readyState === WebSocket.OPEN
              ) {
                receiverSocket.send(payload);
              }
            }

            // Send confirmation/message back to sender
            if (socket.readyState === WebSocket.OPEN) {
              socket.send(payload);
            }
          }
        } catch (error) {
          console.error("WebSocket message error:", error);

          if (socket.readyState === WebSocket.OPEN) {
            socket.send(
              JSON.stringify({
                type: "error",
                message: "Unable to process message",
              }),
            );
          }
        }
      });

      socket.on("close", () => {
        // Don't remove a newer connection for the same user
        if (socket.userId && clients.get(socket.userId) === socket) {
          clients.delete(socket.userId);
          console.log(`${socket.userId} disconnected`);
        }
      });

      socket.on("error", (error) => {
        console.error("WebSocket error:", error.message);
      });
    });

    const PORT = process.env.PORT || 3000;

    server.listen(PORT, "0.0.0.0", () => {
      console.log(`Admin + Next.js running on port ${PORT}`);
      console.log(`WebSocket endpoint: ws://localhost:${PORT}/ws`);
    });
  } catch (error) {
    console.error("Server startup failed:", error);
    process.exit(1);
  }
}

startServer();
