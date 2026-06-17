// -----------------------------------------------------------------------
// studio.controller.js
// Creator Studio endpoints - dashboard stats, video management,
// per-video analytics, and comment management for creators.
// All routes require verifyJWT + role "creator" or "admin".
// -----------------------------------------------------------------------

import { Video } from "../models/Video.model.js";
import { Short } from "../models/Short.model.js";
import { Subscription } from "../models/Subscription.model.js";
import { Comment } from "../models/Comment.model.js";
import { Like } from "../models/Like.model.js";
import { ApiResponse } from "../utils/apiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import { getPagination, buildPaginatedResponse } from "../utils/pagination.js";

// GET /api/v1/studio/overview
// Dashboard KPIs for the creator's Studio home page.
export const getStudioOverview = asyncHandler(async (req, res) => {
  const ownerId = req.user._id;

  const [
    totalVideos,
    totalShorts,
    subscriberCount,
    totalViews,
    recentVideos,
  ] = await Promise.all([
    Video.countDocuments({ owner: ownerId }),
    Short.countDocuments({ owner: ownerId }),
    Subscription.countDocuments({ channel: ownerId }),
    // Sum all views across the creator's videos
    Video.aggregate([
      { $match: { owner: ownerId } },
      { $group: { _id: null, totalViews: { $sum: "$views" } } },
    ]),
    // Last 5 uploaded videos for the "recent uploads" section
    Video.find({ owner: ownerId })
      .sort({ createdAt: -1 })
      .limit(5)
      .select("title views thumbnail createdAt visibility"),
  ]);

  return res.status(200).json(
    new ApiResponse(200, {
      totalVideos,
      totalShorts,
      subscriberCount,
      totalViews: totalViews[0]?.totalViews || 0,
      recentVideos,
    })
  );
});

// GET /api/v1/studio/videos - creator's own videos with stats
export const getStudioVideos = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req);
  const { visibility } = req.query;

  const filter = { owner: req.user._id };
  if (visibility) filter.visibility = visibility;

  const [videos, total] = await Promise.all([
    Video.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Video.countDocuments(filter),
  ]);

  // Enrich with like counts
  const enriched = await Promise.all(
    videos.map(async (video) => {
      const likeCount = await Like.countDocuments({ contentId: video._id, contentType: "Video" });
      return { ...video.toObject(), likeCount };
    })
  );

  return res.status(200).json(
    new ApiResponse(200, buildPaginatedResponse(enriched, total, page, limit))
  );
});

// GET /api/v1/studio/videos/:id/analytics
// Per-video analytics: views over time, likes, comments.
// (Simplified: real-time analytics would need a TimeSeries DB.
//  We return aggregate stats + a simulated last-30-days view array.)
export const getVideoAnalytics = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const video = await Video.findOne({ _id: id, owner: req.user._id });
  if (!video) {
    return res.status(404).json({ success: false, message: "Video not found" });
  }

  const [likeCount, commentCount] = await Promise.all([
    Like.countDocuments({ contentId: id, contentType: "Video" }),
    Comment.countDocuments({ contentId: id, contentType: "Video" }),
  ]);

  // Simulate a 30-day views breakdown for the chart
  // In a real app you'd store daily view snapshots in a separate collection
  const last30Days = Array.from({ length: 30 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (29 - i));
    return {
      date: date.toISOString().split("T")[0],
      views: Math.floor(Math.random() * (video.views / 30) * 2), // simulated
    };
  });

  return res.status(200).json(
    new ApiResponse(200, {
      video: { title: video.title, views: video.views, createdAt: video.createdAt },
      likeCount,
      commentCount,
      viewsChart: last30Days,
    })
  );
});

// GET /api/v1/studio/comments - all comments on creator's content
export const getStudioComments = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req);

  // Get IDs of all videos owned by this creator
  const videos = await Video.find({ owner: req.user._id }).select("_id");
  const videoIds = videos.map((v) => v._id);

  const [comments, total] = await Promise.all([
    Comment.find({ contentId: { $in: videoIds }, contentType: "Video", parentComment: null })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("owner", "username fullName avatar")
      .populate("contentId", "title"),
    Comment.countDocuments({ contentId: { $in: videoIds }, contentType: "Video", parentComment: null }),
  ]);

  return res.status(200).json(
    new ApiResponse(200, buildPaginatedResponse(comments, total, page, limit))
  );
});
