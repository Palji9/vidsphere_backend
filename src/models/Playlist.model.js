// ─────────────────────────────────────────────────────────────────────────
// Playlist.model.js
// A user-created collection of videos (e.g. "My Favorites", "Watch Later").
//
// `videos` is an ordered array of Video IDs -- order matters here because
// playlists play videos in sequence. Reordering = rearranging this array.
// ─────────────────────────────────────────────────────────────────────────

import mongoose, { Schema } from "mongoose";

const playlistSchema = new Schema(
  {
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      default: "",
      maxlength: 500,
    },
    videos: [
      {
        type: Schema.Types.ObjectId,
        ref: "Video",
      },
    ],
    visibility: {
      type: String,
      enum: ["public", "unlisted", "private"],
      default: "private",
    },
  },
  { timestamps: true }
);

export const Playlist = mongoose.model("Playlist", playlistSchema);
