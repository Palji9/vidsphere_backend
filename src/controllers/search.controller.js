// -----------------------------------------------------------------------
// search.controller.js
// Full-text search across Videos, Shorts, Posts, and Users using
// MongoDB's $text search operator (requires text indexes on each model).
// -----------------------------------------------------------------------

import { Video } from "../models/Video.model.js";
import { Short } from "../models/Short.model.js";
import { Post } from "../models/Post.model.js";
import { User } from "../models/User.model.js";
import { ApiResponse } from "../utils/apiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";

// GET /api/v1/search?q=react&type=all
// Returns results for the given query, filtered by type.
export const search = asyncHandler(async (req, res) => {
  const { q, type = "all" } = req.query;

  if (!q || q.trim().length < 1) {
    return res.status(200).json(new ApiResponse(200, { videos: [], shorts: [], channels: [], posts: [] }));
  }

  const query = q.trim();

  // Run searches in parallel for performance
  const [videos, shorts, channels, posts] = await Promise.all([
    (type === "all" || type === "videos")
      ? Video.find(
          { $text: { $search: query }, visibility: "public", isPublished: true },
          { score: { $meta: "textScore" } }
        )
          .sort({ score: { $meta: "textScore" } })
          .limit(20)
          .populate("owner", "username fullName avatar")
      : [],

    (type === "all" || type === "shorts")
      ? Short.find(
          { $text: { $search: query }, isPublished: true },
          { score: { $meta: "textScore" } }
        )
          .sort({ score: { $meta: "textScore" } })
          .limit(10)
          .populate("owner", "username fullName avatar")
      : [],

    (type === "all" || type === "channels")
      ? User.find({ $or: [
          { username: { $regex: query, $options: "i" } },
          { fullName: { $regex: query, $options: "i" } },
        ]})
          .select("username fullName avatar bio")
          .limit(10)
      : [],

    (type === "all" || type === "posts")
      ? Post.find(
          { $text: { $search: query } },
          { score: { $meta: "textScore" } }
        )
          .sort({ score: { $meta: "textScore" } })
          .limit(10)
          .populate("owner", "username fullName avatar")
      : [],
  ]);

  return res.status(200).json(new ApiResponse(200, { videos, shorts, channels, posts }));
});

// GET /api/v1/search/autocomplete?q=react
// Quick suggestions for the search bar dropdown (username + video title matches).
export const autocomplete = asyncHandler(async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 2) {
    return res.status(200).json(new ApiResponse(200, []));
  }

  const regex = new RegExp(q.trim(), "i");

  const [videoTitles, usernames] = await Promise.all([
    Video.find({ title: regex, visibility: "public" })
      .select("title")
      .limit(5),
    User.find({ $or: [{ username: regex }, { fullName: regex }] })
      .select("username fullName avatar")
      .limit(5),
  ]);

  const suggestions = [
    ...videoTitles.map((v) => ({ type: "video", label: v.title, id: v._id })),
    ...usernames.map((u) => ({ type: "channel", label: u.fullName || u.username, username: u.username, avatar: u.avatar })),
  ];

  return res.status(200).json(new ApiResponse(200, suggestions));
});
