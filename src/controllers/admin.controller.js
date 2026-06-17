// -----------------------------------------------------------------------
// admin.controller.js
// Admin panel endpoints: platform stats, user management, content
// moderation (reports), and audit log.
// ALL routes require verifyJWT + authorize("admin").
// -----------------------------------------------------------------------

import { User } from "../models/User.model.js";
import { Video } from "../models/Video.model.js";
import { Short } from "../models/Short.model.js";
import { Post } from "../models/Post.model.js";
import { Report } from "../models/AuditLog.model.js";
import { AuditLog } from "../models/AuditLog.model.js";
import { Comment } from "../models/Comment.model.js";
import { Like } from "../models/Like.model.js";
import { Subscription } from "../models/Subscription.model.js";
import { ApiError, ApiResponse } from "../utils/apiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import { getPagination, buildPaginatedResponse } from "../utils/pagination.js";

// Helper: write an entry to the audit log
const audit = async (adminId, action, targetType, targetId, meta = {}) => {
  await AuditLog.create({ admin: adminId, action, targetType, targetId, meta });
};

// ========================================================================
// GET /api/v1/admin/stats - platform-wide KPIs
// ========================================================================
export const getPlatformStats = asyncHandler(async (req, res) => {
  const [
    totalUsers,
    totalVideos,
    totalShorts,
    totalPosts,
    pendingReports,
    newUsersToday,
    totalViews,
  ] = await Promise.all([
    User.countDocuments(),
    Video.countDocuments(),
    Short.countDocuments(),
    Post.countDocuments(),
    Report.countDocuments({ status: "pending" }),
    User.countDocuments({ createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) } }),
    Video.aggregate([{ $group: { _id: null, total: { $sum: "$views" } } }]),
  ]);

  return res.status(200).json(
    new ApiResponse(200, {
      totalUsers,
      totalVideos,
      totalShorts,
      totalPosts,
      pendingReports,
      newUsersToday,
      totalViews: totalViews[0]?.total || 0,
    })
  );
});

// ========================================================================
// GET /api/v1/admin/users - all users with filters
// ========================================================================
export const getAllUsers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req);
  const { role, search } = req.query;

  const filter = {};
  if (role) filter.role = role;
  if (search) {
    filter.$or = [
      { username: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { fullName: { $regex: search, $options: "i" } },
    ];
  }

  const [users, total] = await Promise.all([
    User.find(filter)
      .select("-password -refreshToken")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    User.countDocuments(filter),
  ]);

  return res.status(200).json(
    new ApiResponse(200, buildPaginatedResponse(users, total, page, limit))
  );
});

// ========================================================================
// PATCH /api/v1/admin/users/:id/role - change a user's role
// ========================================================================
export const changeUserRole = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  const VALID_ROLES = ["user", "creator", "moderator", "admin"];
  if (!VALID_ROLES.includes(role)) throw new ApiError(400, "Invalid role");

  const user = await User.findByIdAndUpdate(id, { role }, { new: true }).select("-password -refreshToken");
  if (!user) throw new ApiError(404, "User not found");

  await audit(req.user._id, "CHANGE_ROLE", "User", id, { previousRole: user.role, newRole: role });

  return res.status(200).json(new ApiResponse(200, user, "User role updated"));
});

// ========================================================================
// DELETE /api/v1/admin/users/:id - hard delete a user and all their content
// ========================================================================
export const deleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const user = await User.findById(id);
  if (!user) throw new ApiError(404, "User not found");
  if (id === req.user._id.toString()) throw new ApiError(400, "Cannot delete your own account via admin");

  // Cascade delete all content owned by this user
  const userVideos = await Video.find({ owner: id }).select("_id");
  const videoIds = userVideos.map((v) => v._id);

  await Promise.all([
    Video.deleteMany({ owner: id }),
    Short.deleteMany({ owner: id }),
    Post.deleteMany({ owner: id }),
    Comment.deleteMany({ owner: id }),
    Like.deleteMany({ likedBy: id }),
    Subscription.deleteMany({ $or: [{ subscriber: id }, { channel: id }] }),
    // Also delete comments/likes on their videos
    Comment.deleteMany({ contentId: { $in: videoIds } }),
    Like.deleteMany({ contentId: { $in: videoIds } }),
    User.findByIdAndDelete(id),
  ]);

  await audit(req.user._id, "DELETE_USER", "User", id, { username: user.username });

  return res.status(200).json(new ApiResponse(200, {}, "User and all their content deleted"));
});

// ========================================================================
// GET /api/v1/admin/reports - all pending reports
// ========================================================================
export const getReports = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req);
  const { status } = req.query;

  const filter = {};
  if (status) filter.status = status;
  else filter.status = "pending";

  const [reports, total] = await Promise.all([
    Report.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("reporter", "username fullName avatar")
      .populate("reviewedBy", "username"),
    Report.countDocuments(filter),
  ]);

  return res.status(200).json(
    new ApiResponse(200, buildPaginatedResponse(reports, total, page, limit))
  );
});

// ========================================================================
// PATCH /api/v1/admin/reports/:id - resolve a report
// ========================================================================
export const resolveReport = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, resolution } = req.body;

  const VALID_STATUSES = ["reviewed", "resolved", "dismissed"];
  if (!VALID_STATUSES.includes(status)) throw new ApiError(400, "Invalid status");

  const report = await Report.findByIdAndUpdate(
    id,
    { status, resolution: resolution || "", reviewedBy: req.user._id },
    { new: true }
  );
  if (!report) throw new ApiError(404, "Report not found");

  await audit(req.user._id, "RESOLVE_REPORT", "Report", id, { status, resolution });

  return res.status(200).json(new ApiResponse(200, report, "Report resolved"));
});

// ========================================================================
// GET /api/v1/admin/audit - full audit log
// ========================================================================
export const getAuditLog = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req);

  const [logs, total] = await Promise.all([
    AuditLog.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("admin", "username fullName"),
    AuditLog.countDocuments(),
  ]);

  return res.status(200).json(
    new ApiResponse(200, buildPaginatedResponse(logs, total, page, limit))
  );
});
