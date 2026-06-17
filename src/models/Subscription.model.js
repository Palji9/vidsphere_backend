// ─────────────────────────────────────────────────────────────────────────
// Subscription.model.js
// Represents one user subscribing to another user's channel.
//
// "subscriber" subscribes to "channel" (which is just another User).
//
// To get a channel's subscriber count:
//   Subscription.countDocuments({ channel: channelId })
//
// To get the channels a user is subscribed to:
//   Subscription.find({ subscriber: userId }).populate("channel")
// ─────────────────────────────────────────────────────────────────────────

import mongoose, { Schema } from "mongoose";

const subscriptionSchema = new Schema(
  {
    subscriber: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    channel: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Controls which notifications this subscriber gets from this channel.
    //   all          -> notified for every new video/short/post
    //   personalized -> only notified for "highlights" (kept simple: same as 'all' in v1)
    //   none         -> bell is muted, no notifications
    notifyPreference: {
      type: String,
      enum: ["all", "personalized", "none"],
      default: "personalized",
    },
  },
  { timestamps: true }
);

// A user can only subscribe to a specific channel ONCE.
subscriptionSchema.index({ subscriber: 1, channel: 1 }, { unique: true });

export const Subscription = mongoose.model("Subscription", subscriptionSchema);
