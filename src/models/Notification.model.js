// -----------------------------------------------------------------------
// Notification.model.js
// One document = one notification shown in a user's notification bell.
//
// `type` tells the frontend which icon/text template to use, and
// `entityId` + `entityType` tell it what to link to when clicked
// (e.g. clicking a "new_comment" notification opens that video/post).
// -----------------------------------------------------------------------

import mongoose, { Schema } from "mongoose";

const notificationSchema = new Schema(
  {
    // Who receives/sees this notification
    recipient: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // Who triggered it (e.g. the person who liked/commented/subscribed).
    // Can be null for system notifications.
    actor: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    type: {
      type: String,
      enum: [
        "new_video",       // a subscribed channel uploaded a video
        "new_short",       // a subscribed channel posted a short
        "new_post",        // a subscribed channel posted to community
        "new_subscriber",  // someone subscribed to your channel
        "like",            // someone liked your video/short/post/comment
        "comment",         // someone commented on your content
        "reply",           // someone replied to your comment
        "mention",         // someone @mentioned you
        "new_message",     // you received a new DM
        "live_start",      // a subscribed channel went live
      ],
      required: true,
    },
    // What this notification is about - e.g. the Video/Post/Comment _id
    entityId: {
      type: Schema.Types.ObjectId,
      default: null,
    },
    entityType: {
      type: String,
      enum: ["Video", "Short", "Post", "Comment", "User", "LiveStream", "Conversation"],
      default: null,
    },
    // Has the recipient seen/opened this notification yet?
    read: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Speeds up the common query: "get my unread notifications, newest first"
notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });

export const Notification = mongoose.model("Notification", notificationSchema);
