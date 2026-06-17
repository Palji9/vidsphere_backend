// -----------------------------------------------------------------------
// subscription.controller.js
// Subscribe/unsubscribe to a channel (toggle), get subscriber list,
// get channels the user is subscribed to.
// -----------------------------------------------------------------------

import { Subscription } from "../models/Subscription.model.js";
import { User } from "../models/User.model.js";
import { ApiError, ApiResponse } from "../utils/apiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";

// ========================================================================
// POST /api/v1/subscriptions/:channelId/toggle
// Subscribe or unsubscribe from a channel (toggle).
// ========================================================================
export const toggleSubscription = asyncHandler(async (req, res) => {
  const { channelId } = req.params;

  if (channelId === req.user._id.toString()) {
    throw new ApiError(400, "You cannot subscribe to your own channel");
  }

  const channelExists = await User.findById(channelId);
  if (!channelExists) {
    throw new ApiError(404, "Channel not found");
  }

  const existing = await Subscription.findOne({
    subscriber: req.user._id,
    channel: channelId,
  });

  let isSubscribed;
  if (existing) {
    await Subscription.findByIdAndDelete(existing._id);
    isSubscribed = false;
  } else {
    await Subscription.create({ subscriber: req.user._id, channel: channelId });
    isSubscribed = true;
  }

  const subscriberCount = await Subscription.countDocuments({ channel: channelId });

  return res
    .status(200)
    .json(new ApiResponse(200, { isSubscribed, subscriberCount }, isSubscribed ? "Subscribed" : "Unsubscribed"));
});

// ========================================================================
// PATCH /api/v1/subscriptions/:channelId/notify
// Change notification preference for a subscription (all/personalized/none).
// ========================================================================
export const updateNotifyPreference = asyncHandler(async (req, res) => {
  const { channelId } = req.params;
  const { preference } = req.body;

  const VALID_PREFS = ["all", "personalized", "none"];
  if (!VALID_PREFS.includes(preference)) {
    throw new ApiError(400, `preference must be one of: ${VALID_PREFS.join(", ")}`);
  }

  const sub = await Subscription.findOneAndUpdate(
    { subscriber: req.user._id, channel: channelId },
    { notifyPreference: preference },
    { new: true }
  );

  if (!sub) {
    throw new ApiError(404, "You are not subscribed to this channel");
  }

  return res.status(200).json(new ApiResponse(200, sub, "Notification preference updated"));
});

// ========================================================================
// GET /api/v1/subscriptions/:channelId/subscribers
// Get list of subscribers for a channel.
// ========================================================================
export const getSubscribers = asyncHandler(async (req, res) => {
  const { channelId } = req.params;

  const subscribers = await Subscription.find({ channel: channelId })
    .populate("subscriber", "username fullName avatar")
    .sort({ createdAt: -1 });

  return res.status(200).json(
    new ApiResponse(200, {
      subscribers: subscribers.map((s) => s.subscriber),
      total: subscribers.length,
    })
  );
});

// ========================================================================
// GET /api/v1/subscriptions/my-channels
// Get channels the current user is subscribed to (sidebar list).
// ========================================================================
export const getMySubscriptions = asyncHandler(async (req, res) => {
  const subs = await Subscription.find({ subscriber: req.user._id })
    .populate("channel", "username fullName avatar")
    .sort({ createdAt: -1 });

  return res.status(200).json(
    new ApiResponse(200, subs.map((s) => ({ ...s.channel.toObject(), notifyPreference: s.notifyPreference })))
  );
});
