// ─────────────────────────────────────────────────────────────────────────
// Short.model.js
// Represents a Short — a vertical, mobile-style video (like YouTube Shorts
// or TikTok/Instagram Reels). Kept as a separate, lightweight model from
// Video because Shorts have a different feed (vertical, swipeable) and
// don't need fields like chapters, categories, etc.
// ─────────────────────────────────────────────────────────────────────────

import mongoose, { Schema } from "mongoose";

const shortSchema = new Schema(
  {
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // Path to the vertical video file, e.g. "/uploads/shorts/abc123.mp4"
    videoFile: {
      type: String,
      required: true,
    },
    thumbnail: {
      type: String,
      default: "",
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },
    views: {
      type: Number,
      default: 0,
    },
    tags: [
      {
        type: String,
        trim: true,
        lowercase: true,
      },
    ],
    isPublished: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

shortSchema.index({ title: "text", tags: "text" });

export const Short = mongoose.model("Short", shortSchema);
