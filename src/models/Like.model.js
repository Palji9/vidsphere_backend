// ─────────────────────────────────────────────────────────────────────────
// Like.model.js
//
// Same polymorphic pattern as Comment.model.js -- ONE collection handles
// likes for Videos, Shorts, Posts, AND Comments.
//
// A "like" document existing means "this user likes this content".
// To "unlike", we simply DELETE the document (see like.controller.js).
//
// The compound unique index below means MongoDB will reject any attempt
// to insert a duplicate like (same user + same content) -- this is our
// safeguard against double-likes from rapid double-clicks.
// ─────────────────────────────────────────────────────────────────────────

import mongoose, { Schema } from "mongoose";

const likeSchema = new Schema(
  {
    likedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    contentId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    contentType: {
      type: String,
      enum: ["Video", "Short", "Post", "Comment"],
      required: true,
    },
  },
  { timestamps: true }
);

// Ensures one user can only like a specific piece of content ONCE.
likeSchema.index(
  { likedBy: 1, contentId: 1, contentType: 1 },
  { unique: true }
);

export const Like = mongoose.model("Like", likeSchema);
