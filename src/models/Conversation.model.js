// -----------------------------------------------------------------------
// Conversation.model.js
// Represents a DM thread between 2+ users (direct message or group chat).
// The actual messages live in the separate Message collection and
// reference this conversation's _id.
// -----------------------------------------------------------------------

import mongoose, { Schema } from "mongoose";

const conversationSchema = new Schema(
  {
    // For a 1-on-1 DM this array has exactly 2 users.
    // For a group chat it can have up to 20 (enforced in controller).
    participants: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
    // true = group chat (has a name/avatar), false = 1-on-1 DM
    isGroup: {
      type: Boolean,
      default: false,
    },
    // Only used for group chats
    groupName: {
      type: String,
      default: "",
    },
    groupAvatar: {
      type: String,
      default: "",
    },
    // Denormalized "last message" info so the conversation list page
    // can display a preview WITHOUT querying the Message collection
    // for every single conversation (huge performance win).
    lastMessage: {
      type: String,
      default: "",
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

export const Conversation = mongoose.model("Conversation", conversationSchema);

// -----------------------------------------------------------------------
// Message.model.js
// A single message within a Conversation.
// -----------------------------------------------------------------------

const messageSchema = new Schema(
  {
    conversation: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: {
      type: String,
      trim: true,
      default: "",
    },
    // type lets the frontend render the message correctly
    //   text  -> just `content` text
    //   image -> `attachment` is an image URL
    //   video -> `attachment` is a Video _id (rich preview card)
    type: {
      type: String,
      enum: ["text", "image", "video"],
      default: "text",
    },
    attachment: {
      type: String, // image URL OR a Video _id (as string) depending on `type`
      default: "",
    },
    // Array of user IDs who have read this message (for read receipts/ticks)
    readBy: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { timestamps: true }
);

export const Message = mongoose.model("Message", messageSchema);
