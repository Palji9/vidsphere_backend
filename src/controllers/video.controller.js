// -----------------------------------------------------------------------
// video.controller.js
// Core video CRUD: upload, list (home feed), watch, edit, delete,
// trending, category browse, related videos, subscriptions feed.
// -----------------------------------------------------------------------

import { Video } from "../models/Video.model.js";
import { User } from "../models/User.model.js";
import { Subscription } from "../models/Subscription.model.js";
import { Like } from "../models/Like.model.js";
import { Comment } from "../models/Comment.model.js";
import { ApiError, ApiResponse } from "../utils/apiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import { getPagination, buildPaginatedResponse } from "../utils/pagination.js";
import mongoose from "mongoose";

// ========================================================================
// POST /api/v1/videos
// Upload a new video. Requires multer to have processed "videoFile" and
// "thumbnail" (see uploadVideo middleware).
// ========================================================================
export const publishVideo = asyncHandler(async (req, res) => {
  const { title, description, tags, category, visibility, duration } = req.body;

  if (!title) {
    throw new ApiError(400, "Title is required");
  }

  // req.files comes from multer's .fields() config - each key is an array
  if (!req.files?.videoFile?.[0]) {
    throw new ApiError(400, "Video file is required");
  }
  if (!req.files?.thumbnail?.[0]) {
    throw new ApiError(400, "Thumbnail image is required");
  }

  const videoFilePath = `/uploads/videos/${req.files.videoFile[0].filename}`;
  const thumbnailPath = `/uploads/images/${req.files.thumbnail[0].filename}`;

  // tags might arrive as a comma-separated string from a form, e.g. "react,tutorial"
  const tagsArray = tags
    ? tags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean)
    : [];

  const video = await Video.create({
    owner: req.user._id,
    videoFile: videoFilePath,
    thumbnail: thumbnailPath,
    title,
    description: description || "",
    tags: tagsArray,
    category: category || "Other",
    visibility: visibility || "public",
    duration: Number(duration) || 0,
  });

  return res.status(201).json(new ApiResponse(201, video, "Video published successfully"));
});

// ========================================================================
// GET /api/v1/videos
// Home feed - public videos, paginated, newest first (simple ranking).
// ========================================================================
export const getAllVideos = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req);
  const { category } = req.query;

  const filter = { visibility: "public", isPublished: true };
  if (category && category !== "All") {
    filter.category = category;
  }

  const [videos, total] = await Promise.all([
    Video.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("owner", "username fullName avatar"),
    Video.countDocuments(filter),
  ]);

  return res
    .status(200)
    .json(new ApiResponse(200, buildPaginatedResponse(videos, total, page, limit)));
});

// ========================================================================
// GET /api/v1/videos/trending
// Top videos by views within the last 7 days.
// ========================================================================
export const getTrendingVideos = asyncHandler(async (req, res) => {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const videos = await Video.find({
    visibility: "public",
    isPublished: true,
    createdAt: { $gte: sevenDaysAgo },
  })
    .sort({ views: -1 })
    .limit(50)
    .populate("owner", "username fullName avatar");

  return res.status(200).json(new ApiResponse(200, videos, "Trending videos fetched"));
});

// ========================================================================
// GET /api/v1/videos/category/:slug
// ========================================================================
export const getVideosByCategory = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const { page, limit, skip } = getPagination(req);

  const filter = { visibility: "public", isPublished: true, category: slug };

  const [videos, total] = await Promise.all([
    Video.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("owner", "username fullName avatar"),
    Video.countDocuments(filter),
  ]);

  return res
    .status(200)
    .json(new ApiResponse(200, buildPaginatedResponse(videos, total, page, limit)));
});

// ========================================================================
// GET /api/v1/videos/subscriptions
// Feed of videos from channels the current user is subscribed to.
// Requires verifyJWT.
// ========================================================================
export const getSubscriptionFeed = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req);

  // Get list of channel IDs the user follows
  const subs = await Subscription.find({ subscriber: req.user._id }).select("channel");
  const channelIds = subs.map((s) => s.channel);

  const filter = {
    owner: { $in: channelIds },
    visibility: "public",
    isPublished: true,
  };

  const [videos, total] = await Promise.all([
    Video.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("owner", "username fullName avatar"),
    Video.countDocuments(filter),
  ]);

  return res
    .status(200)
    .json(new ApiResponse(200, buildPaginatedResponse(videos, total, page, limit)));
});

// ========================================================================
// GET /api/v1/videos/:id
// Get a single video's details and increment its view count.
// Optional auth - if logged in, adds to watch history.
// ========================================================================
export const getVideoById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid video ID");
  }

  const video = await Video.findById(id).populate("owner", "username fullName avatar");

  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  // Private videos can only be viewed by their owner
  if (video.visibility === "private") {
    if (!req.user || req.user._id.toString() !== video.owner._id.toString()) {
      throw new ApiError(403, "This video is private");
    }
  }

  // Increment view count (simple +1 - in a high-traffic app this would be
  // batched through Redis, but direct increment is fine for this scale).
  video.views += 1;
  await video.save();

  // If logged in, add this video to watch history (most recent first,
  // remove any existing occurrence to avoid duplicates).
  if (req.user) {
    await User.findByIdAndUpdate(req.user._id, {
      $pull: { watchHistory: video._id },
    });
    await User.findByIdAndUpdate(req.user._id, {
      $push: { watchHistory: { $each: [video._id], $position: 0 } },
    });
  }

  // Get like/dislike counts and whether the current user has liked it
  const likesCount = await Like.countDocuments({ contentId: video._id, contentType: "Video" });
  let isLiked = false;
  if (req.user) {
    isLiked = !!(await Like.findOne({
      likedBy: req.user._id,
      contentId: video._id,
      contentType: "Video",
    }));
  }

  const commentsCount = await Comment.countDocuments({ contentId: video._id, contentType: "Video" });

  // Check subscription status for the channel
  let isSubscribed = false;
  if (req.user) {
    isSubscribed = !!(await Subscription.findOne({
      subscriber: req.user._id,
      channel: video.owner._id,
    }));
  }
  const subscriberCount = await Subscription.countDocuments({ channel: video.owner._id });

  return res.status(200).json(
    new ApiResponse(200, {
      ...video.toObject(),
      likesCount,
      isLiked,
      commentsCount,
      isSubscribed,
      subscriberCount,
    })
  );
});

// ========================================================================
// GET /api/v1/videos/:id/related
// Simple "related videos" - same category, excluding the current video.
// ========================================================================
export const getRelatedVideos = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const video = await Video.findById(id);

  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  const related = await Video.find({
    _id: { $ne: video._id },
    visibility: "public",
    category: video.category,
  })
    .sort({ views: -1 })
    .limit(15)
    .populate("owner", "username fullName avatar");

  return res.status(200).json(new ApiResponse(200, related, "Related videos fetched"));
});

// ========================================================================
// PATCH /api/v1/videos/:id
// Edit video metadata. Only the owner can edit.
// ========================================================================
export const updateVideo = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { title, description, tags, category, visibility } = req.body;

  const video = await Video.findById(id);
  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  if (video.owner.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You can only edit your own videos");
  }

  if (title) video.title = title;
  if (description !== undefined) video.description = description;
  if (category) video.category = category;
  if (visibility) video.visibility = visibility;
  if (tags) {
    video.tags = tags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
  }

  // Optionally update thumbnail if a new one was uploaded
  if (req.file) {
    video.thumbnail = `/uploads/images/${req.file.filename}`;
  }

  await video.save();

  return res.status(200).json(new ApiResponse(200, video, "Video updated"));
});

// ========================================================================
// DELETE /api/v1/videos/:id
// Owner can delete their own video. Moderators/Admins can delete any video.
// ========================================================================
export const deleteVideo = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const video = await Video.findById(id);
  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  const isOwner = video.owner.toString() === req.user._id.toString();
  const isStaff = ["moderator", "admin"].includes(req.user.role);

  if (!isOwner && !isStaff) {
    throw new ApiError(403, "You don't have permission to delete this video");
  }

  await Video.findByIdAndDelete(id);

  // Clean up related comments and likes for this video
  await Comment.deleteMany({ contentId: id, contentType: "Video" });
  await Like.deleteMany({ contentId: id, contentType: "Video" });

  return res.status(200).json(new ApiResponse(200, {}, "Video deleted"));
});
