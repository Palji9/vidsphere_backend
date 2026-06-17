// -----------------------------------------------------------------------
// notification.controller.js
// Fetch, read, and delete notifications.
// Notifications are CREATED by other controllers/socket events when
// actions happen (e.g. someone subscribes, comments, likes).
// This file only handles READING and MANAGING existing notifications.
// -----------------------------------------------------------------------

import { Notification } from "../models/Notification.model.js";
import { ApiResponse } from "../utils/apiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import { getPagination, buildPaginatedResponse } from "../utils/pagination.js";

// GET /api/v1/notifications - all notifications for current user
export const getNotifications = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req);
  const { type } = req.query; // optional filter by type

  const filter = { recipient: req.user._id };
  if (type) filter.type = type;

  const [notifications, total] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("actor", "username fullName avatar"),
    Notification.countDocuments(filter),
  ]);

  return res.status(200).json(
    new ApiResponse(200, buildPaginatedResponse(notifications, total, page, limit))
  );
});

// GET /api/v1/notifications/unread-count - just the number (for the bell badge)
export const getUnreadCount = asyncHandler(async (req, res) => {
  const count = await Notification.countDocuments({
    recipient: req.user._id,
    read: false,
  });
  return res.status(200).json(new ApiResponse(200, { count }));
});

// POST /api/v1/notifications/read - mark specific notifications as read
export const markAsRead = asyncHandler(async (req, res) => {
  const { notificationIds } = req.body;

  await Notification.updateMany(
    { _id: { $in: notificationIds }, recipient: req.user._id },
    { $set: { read: true } }
  );

  return res.status(200).json(new ApiResponse(200, {}, "Marked as read"));
});

// POST /api/v1/notifications/read-all - mark all as read
export const markAllAsRead = asyncHandler(async (req, res) => {
  await Notification.updateMany(
    { recipient: req.user._id, read: false },
    { $set: { read: true } }
  );
  return res.status(200).json(new ApiResponse(200, {}, "All notifications marked as read"));
});

// DELETE /api/v1/notifications/:id - delete a single notification
export const deleteNotification = asyncHandler(async (req, res) => {
  await Notification.findOneAndDelete({
    _id: req.params.id,
    recipient: req.user._id,
  });
  return res.status(200).json(new ApiResponse(200, {}, "Notification deleted"));
});

// DELETE /api/v1/notifications - clear all notifications
export const clearAllNotifications = asyncHandler(async (req, res) => {
  await Notification.deleteMany({ recipient: req.user._id });
  return res.status(200).json(new ApiResponse(200, {}, "All notifications cleared"));
});

// -----------------------------------------------------------------------
// createNotification() - internal helper used by other controllers.
// NOT an Express route handler - called programmatically.
// Example: await createNotification({ recipient, actor, type, entityId, entityType })
// -----------------------------------------------------------------------
export const createNotification = async ({ recipient, actor, type, entityId, entityType, io }) => {
  // Don't notify someone about their own actions (e.g. liking your own video)
  if (recipient?.toString() === actor?.toString()) return;

  const notification = await Notification.create({
    recipient,
    actor,
    type,
    entityId,
    entityType,
  });

  // Push to recipient's socket room in real-time
  if (io) {
    io.to(`user:${recipient}`).emit("notif:new", notification);
  }

  return notification;
};
