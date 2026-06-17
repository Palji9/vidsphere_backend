// -----------------------------------------------------------------------
// live.controller.js
// Simplified live streaming via Socket.io (browser camera/screen share).
// See LiveStream.model.js for the approach explanation.
// -----------------------------------------------------------------------

import { LiveStream } from "../models/LiveStream.model.js";
import { Notification } from "../models/Notification.model.js";
import { Subscription } from "../models/Subscription.model.js";
import { ApiError, ApiResponse } from "../utils/apiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";

// GET /api/v1/live - all currently live streams
export const getActiveStreams = asyncHandler(async (req, res) => {
  const streams = await LiveStream.find({ status: "live" })
    .sort({ viewerCount: -1 })
    .populate("owner", "username fullName avatar");
  return res.status(200).json(new ApiResponse(200, streams));
});

// GET /api/v1/live/:id
export const getStreamById = asyncHandler(async (req, res) => {
  const stream = await LiveStream.findById(req.params.id).populate(
    "owner", "username fullName avatar"
  );
  if (!stream) throw new ApiError(404, "Stream not found");
  return res.status(200).json(new ApiResponse(200, stream));
});

// POST /api/v1/live - create a new stream (scheduled or immediate)
export const createStream = asyncHandler(async (req, res) => {
  const { title, description, scheduledAt } = req.body;
  if (!title) throw new ApiError(400, "Title is required");

  const stream = await LiveStream.create({
    owner: req.user._id,
    title,
    description: description || "",
    scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
    status: scheduledAt ? "scheduled" : "scheduled",
  });

  return res.status(201).json(new ApiResponse(201, stream, "Stream created"));
});

// POST /api/v1/live/:id/start - set stream to live, notify subscribers
export const startStream = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const stream = await LiveStream.findOne({ _id: id, owner: req.user._id });
  if (!stream) throw new ApiError(404, "Stream not found");

  stream.status = "live";
  stream.startedAt = new Date();
  await stream.save();

  // Notify all subscribers that this channel went live
  const io = req.app.get("io");
  const subs = await Subscription.find({
    channel: req.user._id,
    notifyPreference: { $in: ["all", "personalized"] },
  }).select("subscriber");

  subs.forEach(async (sub) => {
    // Create DB notification
    await Notification.create({
      recipient: sub.subscriber,
      actor: req.user._id,
      type: "live_start",
      entityId: stream._id,
      entityType: "LiveStream",
    });
    // Push real-time notification
    if (io) {
      io.to(`user:${sub.subscriber}`).emit("notif:new", {
        type: "live_start",
        actor: { username: req.user.username, avatar: req.user.avatar },
        entityId: stream._id,
      });
    }
  });

  return res.status(200).json(new ApiResponse(200, stream, "Stream started"));
});

// POST /api/v1/live/:id/end
export const endStream = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const stream = await LiveStream.findOne({ _id: id, owner: req.user._id });
  if (!stream) throw new ApiError(404, "Stream not found");

  stream.status = "ended";
  stream.endedAt = new Date();
  stream.viewerCount = 0;
  await stream.save();

  // Tell all viewers the stream has ended
  const io = req.app.get("io");
  if (io) {
    io.to(`live:${id}`).emit("live:ended", { streamId: id });
  }

  return res.status(200).json(new ApiResponse(200, stream, "Stream ended"));
});

// DELETE /api/v1/live/:id
export const deleteStream = asyncHandler(async (req, res) => {
  const stream = await LiveStream.findOneAndDelete({ _id: req.params.id, owner: req.user._id });
  if (!stream) throw new ApiError(404, "Stream not found");
  return res.status(200).json(new ApiResponse(200, {}, "Stream deleted"));
});
