// -----------------------------------------------------------------------
// LiveStream.model.js
//
// SIMPLIFIED LIVE STREAMING:
// Real live streaming normally requires an RTMP server (e.g. Node-Media-Server)
// receiving video from OBS and converting it to HLS for viewers. That's a
// big piece of infrastructure on its own.
//
// For this portfolio project, "Live" is simulated:
//   - The "streamer" shares their browser camera/screen using
//     the MediaRecorder API + sends video chunks over Socket.io
//     to viewers in the same "room" (peer-to-peer style via the server).
//   - This LiveStream document just tracks the metadata: who's live,
//     title, status, and viewer count.
//
// This keeps the feature interactive and real-time without needing
// dedicated streaming infrastructure -- great for a portfolio demo.
// -----------------------------------------------------------------------

import mongoose, { Schema } from "mongoose";

const liveStreamSchema = new Schema(
  {
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },
    description: {
      type: String,
      default: "",
      maxlength: 1000,
    },
    thumbnail: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["scheduled", "live", "ended"],
      default: "scheduled",
    },
    // Updated in real-time via Socket.io as viewers join/leave
    viewerCount: {
      type: Number,
      default: 0,
    },
    scheduledAt: {
      type: Date,
      default: null,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    endedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

export const LiveStream = mongoose.model("LiveStream", liveStreamSchema);
