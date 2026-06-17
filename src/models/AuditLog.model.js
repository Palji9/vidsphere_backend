// -----------------------------------------------------------------------
// Report.model.js
// Created when a user reports a piece of content (video/short/post/comment)
// or another user for violating community guidelines.
// Moderators/Admins review these in the Admin panel.
// -----------------------------------------------------------------------

import mongoose, { Schema } from "mongoose";

const reportSchema = new Schema(
  {
    reporter: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    targetId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    targetType: {
      type: String,
      enum: ["Video", "Short", "Post", "Comment", "User"],
      required: true,
    },
    reason: {
      type: String,
      enum: [
        "spam",
        "harassment",
        "hate_speech",
        "violence",
        "nudity",
        "misinformation",
        "copyright",
        "other",
      ],
      required: true,
    },
    details: {
      type: String,
      default: "",
      maxlength: 1000,
    },
    status: {
      type: String,
      enum: ["pending", "reviewed", "resolved", "dismissed"],
      default: "pending",
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    resolution: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

reportSchema.index({ status: 1, createdAt: -1 });

export const Report = mongoose.model("Report", reportSchema);

// -----------------------------------------------------------------------
// AuditLog.model.js
// Records every important admin action for accountability.
// Example: "admin X banned user Y at time Z"
// -----------------------------------------------------------------------

const auditLogSchema = new Schema(
  {
    admin: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    action: {
      type: String,
      required: true,
    },
    targetType: {
      type: String,
      default: null,
    },
    targetId: {
      type: Schema.Types.ObjectId,
      default: null,
    },
    meta: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

export const AuditLog = mongoose.model("AuditLog", auditLogSchema);
