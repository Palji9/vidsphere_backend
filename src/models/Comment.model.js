// ─────────────────────────────────────────────────────────────────────────
// Comment.model.js
//
// DESIGN NOTE: This is a "polymorphic" model — ONE Comment collection is
// used for comments on Videos, Shorts, AND Posts. This avoids having
// VideoComment, ShortComment, PostComment as separate collections with
// duplicate logic.
//
// How it works:
//   - `contentId`   -> the _id of the Video/Short/Post being commented on
//   - `contentType` -> a string telling us WHICH model contentId refers to
//
// When querying, we do: Comment.find({ contentId: videoId, contentType: "Video" })
//
// Replies (nested comments) are supported via `parentComment`, with a
// max depth of 2 (top-level comment -> reply -> reply-to-reply is blocked
// in the controller to keep UI simple).
// ─────────────────────────────────────────────────────────────────────────

import mongoose, { Schema } from "mongoose";

const commentSchema = new Schema(
  {
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // The Video/Short/Post this comment belongs to.
    contentId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    // Tells us which collection `contentId` points to.
    contentType: {
      type: String,
      enum: ["Video", "Short", "Post"],
      required: true,
    },
    // If this is a reply, this points to the parent comment.
    // Top-level comments have parentComment = null.
    parentComment: {
      type: Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
      index: true,
    },
    isPinned: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

export const Comment = mongoose.model("Comment", commentSchema);
