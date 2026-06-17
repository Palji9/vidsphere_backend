// ─────────────────────────────────────────────────────────────────────────
// Video.model.js
// Represents a long-form video uploaded by a creator.
//
// NOTE on video storage: per project requirements, we are NOT running
// FFmpeg/HLS transcoding. The uploaded video file is stored as-is on disk
// (via Multer, see middleware/multer.js) and played in the browser with a
// normal HTML <video> tag. `videoFile` stores the relative path/URL to it.
// ─────────────────────────────────────────────────────────────────────────

import mongoose, { Schema } from "mongoose";

const videoSchema = new Schema(
  {
    // The creator who uploaded this video.
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // Path to the actual video file, e.g. "/uploads/videos/abc123.mp4"
    videoFile: {
      type: String,
      required: true,
    },
    // Path to the thumbnail image, e.g. "/uploads/images/thumb123.jpg"
    thumbnail: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      default: "",
      maxlength: 5000,
    },
    // Duration in seconds. We can read this from the video file metadata
    // on the frontend (using the <video> element's loadedmetadata event)
    // and send it to the backend when creating the video record.
    duration: {
      type: Number,
      default: 0,
    },
    // Total view count. Incremented each time someone watches.
    views: {
      type: Number,
      default: 0,
    },
    // Tags for search/discovery, e.g. ["react", "tutorial", "javascript"]
    tags: [
      {
        type: String,
        trim: true,
        lowercase: true,
      },
    ],
    category: {
      type: String,
      default: "Other",
      // Matches the category chips shown on the Explore page
      enum: [
        "Music", "Gaming", "News", "Sports", "Education",
        "Entertainment", "Technology", "Travel", "Comedy", "Other",
      ],
    },
    // public   = anyone can find & watch
    // unlisted = only people with the direct link can watch
    // private  = only the owner can watch
    visibility: {
      type: String,
      enum: ["public", "unlisted", "private"],
      default: "public",
    },
    // Whether the video has finished "processing" — since we skip
    // transcoding, this is mostly set to true immediately after upload,
    // but kept here so the frontend UI flow (uploading -> processing ->
    // ready) still works the same way as a real-world app.
    isPublished: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Text index allows MongoDB's $text search to search across title,
// description, and tags simultaneously — this powers our search feature
// without needing a separate search engine like Elasticsearch.
videoSchema.index({ title: "text", description: "text", tags: "text" });

export const Video = mongoose.model("Video", videoSchema);
