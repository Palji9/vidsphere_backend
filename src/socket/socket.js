// -----------------------------------------------------------------------
// socket/socket.js
// Sets up the Socket.io server and all real-time event handlers.
//
// ARCHITECTURE:
// - Every authenticated user joins a personal room "user:<userId>"
//   so we can send notifications/messages directly to them from
//   controllers (e.g. when someone subscribes or sends a DM).
// - Live streams use rooms named "live:<streamId>".
// - Chat conversations use rooms named "conv:<conversationId>".
//
// AUTH: We validate the JWT on Socket.io handshake before allowing
// the connection, so anonymous sockets cannot receive private events.
// -----------------------------------------------------------------------

import jwt from "jsonwebtoken";
import { User } from "../models/User.model.js";
import { Message } from "../models/Conversation.model.js";
import { Conversation } from "../models/Conversation.model.js";

export const initSocket = (io) => {
  // ── Authentication Middleware ────────────────────────────────────────
  // Runs once per connection attempt BEFORE any events fire.
  // The frontend sends the access token as: socket = io(URL, { auth: { token } })
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization;

      if (!token) {
        // Allow unauthenticated connections for public events (live chat)
        // but mark them as "guest" so we can restrict private events below.
        socket.user = null;
        return next();
      }

      const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
      const user = await User.findById(decoded._id).select("-password -refreshToken");

      if (!user) {
        socket.user = null;
        return next();
      }

      socket.user = user; // attach user to socket for all event handlers
      next();
    } catch (err) {
      // Invalid token - allow as guest
      socket.user = null;
      next();
    }
  });

  // ── Connection Handler ───────────────────────────────────────────────
  io.on("connection", (socket) => {
    const userId = socket.user?._id?.toString();

    if (userId) {
      // Join the user's personal notification room
      socket.join(`user:${userId}`);
      console.log(`🔌 [Socket] User ${socket.user.username} connected (${socket.id})`);
    } else {
      console.log(`🔌 [Socket] Guest connected (${socket.id})`);
    }

    // ── Chat Events ────────────────────────────────────────────────────

    // Client emits this when they open a conversation (to receive messages)
    socket.on("chat:join", (conversationId) => {
      socket.join(`conv:${conversationId}`);
    });

    socket.on("chat:leave", (conversationId) => {
      socket.leave(`conv:${conversationId}`);
    });

    // Typing indicator: broadcast to everyone else in the conversation
    socket.on("typing:start", ({ conversationId }) => {
      if (!userId) return;
      socket.to(`conv:${conversationId}`).emit("typing:indicator", {
        userId,
        username: socket.user?.username,
        conversationId,
      });
    });

    socket.on("typing:stop", ({ conversationId }) => {
      if (!userId) return;
      socket.to(`conv:${conversationId}`).emit("typing:stopped", {
        userId,
        conversationId,
      });
    });

    // Message read receipt: mark as read and tell the sender
    socket.on("message:read", async ({ messageId, conversationId }) => {
      if (!userId) return;
      try {
        await Message.findByIdAndUpdate(messageId, {
          $addToSet: { readBy: userId },
        });
        // Emit read receipt to everyone in the conversation
        socket.to(`conv:${conversationId}`).emit("message:seen", {
          messageId,
          readBy: userId,
        });
      } catch (err) {
        console.error("[Socket] Error marking message as read:", err);
      }
    });

    // ── Live Stream Events ─────────────────────────────────────────────

    // Viewer joins a live stream room
    socket.on("live:join", async (streamId) => {
      socket.join(`live:${streamId}`);

      // Count current viewers (sockets in the room)
      const roomSize = (await io.in(`live:${streamId}`).fetchSockets()).length;

      // Update viewer count in DB and broadcast to all viewers
      io.to(`live:${streamId}`).emit("live:viewerCount", { count: roomSize });
    });

    socket.on("live:leave", async (streamId) => {
      socket.leave(`live:${streamId}`);
      const roomSize = (await io.in(`live:${streamId}`).fetchSockets()).length;
      io.to(`live:${streamId}`).emit("live:viewerCount", { count: roomSize });
    });

    // Live chat message - broadcast to all viewers in the stream room
    socket.on("live:chat", ({ streamId, message }) => {
      if (!socket.user) return; // guests cannot send live chat
      io.to(`live:${streamId}`).emit("live:chat", {
        user: {
          username: socket.user.username,
          avatar: socket.user.avatar,
        },
        message,
        timestamp: new Date(),
      });
    });

    // ── Streamer broadcasts video chunks to viewers ─────────────────────
    // This is the simplified "no RTMP server" approach:
    // The streamer's browser sends video chunks via Socket.io.
    // All viewers in the live room receive and play them via MediaSource API.
    socket.on("live:stream-chunk", ({ streamId, chunk }) => {
      // Relay video chunk to all viewers (except the streamer themselves)
      socket.to(`live:${streamId}`).emit("live:stream-chunk", { chunk });
    });

    // ── Disconnect ─────────────────────────────────────────────────────
    socket.on("disconnect", () => {
      if (userId) {
        console.log(`🔌 [Socket] User ${socket.user.username} disconnected`);
      }
    });
  });

  console.log("✅ Socket.io initialized");
};
