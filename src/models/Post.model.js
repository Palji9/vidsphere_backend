// ─────────────────────────────────────────────────────────────────────────
// Post.model.js
// Represents a "community post" — the social-media side of VidSphere.
// Similar to a tweet or a YouTube Community tab post.
// Can be plain text, an image post, or a poll.
// ─────────────────────────────────────────────────────────────────────────

import mongoose, { Schema } from "mongoose";

const pollOptionSchema = new Schema({
  text: { type: String, required: true, trim: true },
  votes: { type: Number, default: 0 },
});

const postSchema = new Schema(
  {
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // The text content of the post (caption, tweet-like text, etc.)
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    // type determines how the frontend renders this post's extra content
    type: {
      type: String,
      enum: ["text", "image", "poll"],
      default: "text",
    },
    // Image post: array of image URLs (max 4 enforced in controller)
    images: [{ type: String }],
    // Poll post: list of options with vote counts
    poll: {
      options: [pollOptionSchema],
      // Tracks which users have voted so they can't vote twice,
      // and so we can show "you voted for X" on the frontend.
      voters: [
        {
          user: { type: Schema.Types.ObjectId, ref: "User" },
          optionIndex: Number,
        },
      ],
    },
    // Hashtags extracted from content for discovery (e.g. #gaming)
    tags: [{ type: String, lowercase: true, trim: true }],
  },
  { timestamps: true }
);

postSchema.index({ content: "text", tags: "text" });

export const Post = mongoose.model("Post", postSchema);
