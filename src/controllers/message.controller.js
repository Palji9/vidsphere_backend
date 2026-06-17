// -----------------------------------------------------------------------
// message.controller.js
// Direct Messaging: create/list conversations, send/read messages.
// Real-time delivery handled by Socket.io (see socket/handlers/chat.handler.js).
// These REST endpoints handle the data layer (persistence + history).
// -----------------------------------------------------------------------

import { Conversation } from "../models/Conversation.model.js";
import { Message } from "../models/Conversation.model.js";
import { ApiError, ApiResponse } from "../utils/apiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import { getPagination, buildPaginatedResponse } from "../utils/pagination.js";

// GET /api/v1/conversations - all conversations for current user
export const getConversations = asyncHandler(async (req, res) => {
  const conversations = await Conversation.find({
    participants: req.user._id,
  })
    .sort({ lastMessageAt: -1 })
    .populate("participants", "username fullName avatar");

  return res.status(200).json(new ApiResponse(200, conversations));
});

// POST /api/v1/conversations - start a DM or group chat
export const createConversation = asyncHandler(async (req, res) => {
  const { participantIds, isGroup, groupName } = req.body;

  if (!participantIds || !Array.isArray(participantIds) || participantIds.length === 0) {
    throw new ApiError(400, "participantIds is required");
  }

  // Add current user to participants
  const allParticipants = [...new Set([req.user._id.toString(), ...participantIds])];

  if (!isGroup && allParticipants.length === 2) {
    // For 1-on-1 DMs: check if a conversation already exists between these two users
    const existing = await Conversation.findOne({
      isGroup: false,
      participants: { $all: allParticipants, $size: 2 },
    }).populate("participants", "username fullName avatar");

    if (existing) {
      return res.status(200).json(new ApiResponse(200, existing, "Existing conversation returned"));
    }
  }

  const conversation = await Conversation.create({
    participants: allParticipants,
    isGroup: !!isGroup,
    groupName: isGroup ? groupName || "Group Chat" : "",
  });

  await conversation.populate("participants", "username fullName avatar");

  return res.status(201).json(new ApiResponse(201, conversation, "Conversation created"));
});

// GET /api/v1/conversations/:id/messages - paginated message history
export const getMessages = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { page, limit, skip } = getPagination(req);

  // Verify the requesting user is actually in this conversation
  const conversation = await Conversation.findOne({
    _id: id,
    participants: req.user._id,
  });
  if (!conversation) throw new ApiError(404, "Conversation not found");

  const [messages, total] = await Promise.all([
    Message.find({ conversation: id })
      .sort({ createdAt: -1 }) // newest first
      .skip(skip)
      .limit(limit)
      .populate("sender", "username fullName avatar"),
    Message.countDocuments({ conversation: id }),
  ]);

  // Mark all unread messages in this conversation as read by the current user
  await Message.updateMany(
    {
      conversation: id,
      readBy: { $ne: req.user._id },
    },
    { $addToSet: { readBy: req.user._id } }
  );

  return res.status(200).json(
    new ApiResponse(200, buildPaginatedResponse(messages.reverse(), total, page, limit))
  );
});

// POST /api/v1/conversations/:id/messages - send a message (REST + triggers Socket.io emit)
export const sendMessage = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { content, type, attachment } = req.body;

  const conversation = await Conversation.findOne({
    _id: id,
    participants: req.user._id,
  });
  if (!conversation) throw new ApiError(404, "Conversation not found");

  if (!content && !attachment) {
    throw new ApiError(400, "Message must have content or attachment");
  }

  const message = await Message.create({
    conversation: id,
    sender: req.user._id,
    content: content || "",
    type: type || "text",
    attachment: attachment || "",
    readBy: [req.user._id], // sender has read their own message
  });

  await message.populate("sender", "username fullName avatar");

  // Update the conversation's "last message" preview
  await Conversation.findByIdAndUpdate(id, {
    lastMessage: content || "[attachment]",
    lastMessageAt: new Date(),
  });

  // Socket.io delivery: the Socket.io server listens for the "message:send" event.
  // However, we also emit here via the io instance attached to app (see server.js).
  // This way the REST endpoint AND the socket both deliver messages correctly.
  const io = req.app.get("io");
  if (io) {
    conversation.participants.forEach((participantId) => {
      if (participantId.toString() !== req.user._id.toString()) {
        io.to(`user:${participantId}`).emit("message:received", {
          conversationId: id,
          message,
        });
      }
    });
  }

  return res.status(201).json(new ApiResponse(201, message, "Message sent"));
});

// DELETE /api/v1/messages/:messageId - delete own message
export const deleteMessage = asyncHandler(async (req, res) => {
  const { messageId } = req.params;

  const message = await Message.findById(messageId);
  if (!message) throw new ApiError(404, "Message not found");
  if (message.sender.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You can only delete your own messages");
  }

  await Message.findByIdAndDelete(messageId);
  return res.status(200).json(new ApiResponse(200, {}, "Message deleted"));
});
