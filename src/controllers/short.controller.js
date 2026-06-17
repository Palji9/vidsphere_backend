// -----------------------------------------------------------------------
// short.controller.js
// Shorts are vertical videos (<=60s). Very similar to Video but lighter
// (no categories, no chapters, simple feed). Stored separately so the
// Shorts page feed doesn't mix with the main video home feed.
// -----------------------------------------------------------------------

import { Short } from "../models/Short.model.js";
import { Comment } from "../models/Comment.model.js";
import { Like } from "../models/Like.model.js";
import { ApiError, ApiResponse } from "../utils/apiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import { getPagination, buildPaginatedResponse } from "../utils/pagination.js";
import mongoose from "mongoose";

// GET /api/v1/shorts - scrollable Shorts feed
export const getShortsFeed = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req);

  const [shorts, total] = await Promise.all([
    Short.find({ isPublished: true })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("owner", "username fullName avatar"),
    Short.countDocuments({ isPublished: true }),
  ]);

  return res.status(200).json(
    new ApiResponse(200, buildPaginatedResponse(shorts, total, page, limit))
  );
});

// GET /api/v1/shorts/:id - single short with stats
export const getShortById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid short ID");
  }

  const short = await Short.findById(id).populate("owner", "username fullName avatar");
  if (!short) throw new ApiError(404, "Short not found");

  // Increment view count
  short.views += 1;
  await short.save();

  const [likesCount, commentsCount] = await Promise.all([
    Like.countDocuments({ contentId: id, contentType: "Short" }),
    Comment.countDocuments({ contentId: id, contentType: "Short" }),
  ]);

  let isLiked = false;
  if (req.user) {
    isLiked = !!(await Like.findOne({ likedBy: req.user._id, contentId: id, contentType: "Short" }));
  }

  return res.status(200).json(
    new ApiResponse(200, { ...short.toObject(), likesCount, commentsCount, isLiked })
  );
});

// POST /api/v1/shorts - upload a short
export const publishShort = asyncHandler(async (req, res) => {
  const { title, tags } = req.body;

  if (!title) throw new ApiError(400, "Title is required");
  if (!req.files?.videoFile?.[0]) throw new ApiError(400, "Video file is required");

  const videoFilePath = `/uploads/shorts/${req.files.videoFile[0].filename}`;
  const thumbnailPath = req.files?.thumbnail?.[0]
    ? `/uploads/images/${req.files.thumbnail[0].filename}`
    : "";

  const tagsArray = tags
    ? tags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean)
    : [];

  const short = await Short.create({
    owner: req.user._id,
    videoFile: videoFilePath,
    thumbnail: thumbnailPath,
    title,
    tags: tagsArray,
  });

  return res.status(201).json(new ApiResponse(201, short, "Short published"));
});

// PATCH /api/v1/shorts/:id - edit title/tags
export const updateShort = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const short = await Short.findById(id);

  if (!short) throw new ApiError(404, "Short not found");
  if (short.owner.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You can only edit your own shorts");
  }

  if (req.body.title) short.title = req.body.title;
  if (req.body.tags) {
    short.tags = req.body.tags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
  }
  await short.save();

  return res.status(200).json(new ApiResponse(200, short, "Short updated"));
});

// DELETE /api/v1/shorts/:id
export const deleteShort = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const short = await Short.findById(id);

  if (!short) throw new ApiError(404, "Short not found");

  const isOwner = short.owner.toString() === req.user._id.toString();
  const isStaff = ["moderator", "admin"].includes(req.user.role);

  if (!isOwner && !isStaff) throw new ApiError(403, "Not allowed to delete this short");

  await Short.findByIdAndDelete(id);
  await Comment.deleteMany({ contentId: id, contentType: "Short" });
  await Like.deleteMany({ contentId: id, contentType: "Short" });

  return res.status(200).json(new ApiResponse(200, {}, "Short deleted"));
});
