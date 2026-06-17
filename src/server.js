// -----------------------------------------------------------------------
// server.js
// Entry point: loads .env, connects to DB, starts HTTP server + Socket.io.
// Run with: npm run dev
// -----------------------------------------------------------------------

import "dotenv/config"; // loads .env file into process.env FIRST

import { createServer } from "http";
import { Server } from "socket.io";

import app from "./app.js";
import connectDB from "./config/db.js";
import { initSocket } from "./socket/socket.js";

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  // 1. Connect to MongoDB Atlas before starting the HTTP server.
  //    If the connection fails, connectDB() will call process.exit(1).
  await connectDB();

  // 2. Wrap Express app in a raw Node HTTP server so we can attach Socket.io.
  //    (Express itself creates an HTTP server internally, but we need the
  //    reference to pass to Socket.io.)
  const httpServer = createServer(app);

  // 3. Attach Socket.io to the same HTTP server so WS connections share
  //    the same port (5000) as REST requests.
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || "http://localhost:5173",
      credentials: true,
    },
    // maxHttpBufferSize controls the max size of a single Socket.io message.
    // We increase it to allow the live streaming video chunk relay.
    maxHttpBufferSize: 1e7, // 10 MB
  });

  // 4. Register all Socket.io event handlers
  initSocket(io);

  // 5. Make the `io` instance available to Express controllers via req.app.get("io")
  //    This allows controllers (like sendMessage) to emit events after DB writes.
  app.set("io", io);

  // 6. Start listening
  httpServer.listen(PORT, () => {
    console.log(`\n🚀 VidSphere API running on http://localhost:${PORT}`);
    console.log(`📡 Socket.io listening on ws://localhost:${PORT}`);
    console.log(`📁 Static files served from /public`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}\n`);
  });
};

startServer();
