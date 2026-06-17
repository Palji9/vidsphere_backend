// -----------------------------------------------------------------------
// post.controller.js
// Community/social posts - text, image, and poll posts on channels.
// Powers the "Social Feed" page and the "Community" tab on channel pages.
// -----------------------------------------------------------------------

import { Post } from "../models/Post.model.js";
import { Subscription } from "../models/Subscription.model.js";
import { Like } from "../models/Like.model.js";
import { Comment } from "../models/Comment.model.js";
import { ApiError, ApiResponse } from "../utils/apiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import { getPagination, buildPaginatedResponse } from "../utils/pagination.js";

// ========================================================================
// GET /api/v1/posts/feed
// Logged-in user's social feed: posts from channels they follow + their own.
// ========================================================================
export const getSocialFeed = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req);

  const subs = await Subscription.find({ subscriber: req.user._id }).select("channel");
  const followedChannelIds = subs.map((s) => s.channel);
  followedChannelIds.push(req.user._id); // include your own posts in your feed

  const [posts, total] = await Promise.all([
    Post.find({ owner: { $in: followedChannelIds } })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("owner", "username fullName avatar"),
    Post.countDocuments({ owner: { $in: followedChannelIds } }),
  ]);

  return res.status(200).json(
    new ApiResponse(200, buildPaginatedResponse(posts, total, page, limit))
  );
});

// ========================================================================
// GET /api/v1/posts/channel/:username
// All posts from a specific channel's Community tab.
// ========================================================================
export const getChannelPosts = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req);
  const { channelId } = req.params;

  const [posts, total] = await Promise.all([
    Post.find({ owner: channelId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("owner", "username fullName avatar"),
    Post.countDocuments({ owner: channelId }),
  ]);

  return res.status(200).json(
    new ApiResponse(200, buildPaginatedResponse(posts, total, page, limit))
  );
});

// ========================================================================
// POST /api/v1/posts
// Create a new post (text / image / poll).
// ========================================================================
export const createPost = asyncHandler(async (req, res) => {
  const { content, type, poll } = req.body;

  if (!content?.trim()) throw new ApiError(400, "Post content is required");

  const postData = {
    owner: req.user._id,
    content: content.trim(),
    type: type || "text",
    tags: extractHashtags(content),
  };

  // Image post: multer stores uploaded files, we build URL paths
  if (type === "image") {
    if (!req.files || req.files.length === 0) {
      throw new ApiError(400, "At least one image is required for image posts");
    }
    postData.images = req.files.map((f) => `/uploads/images/${f.filename}`);
  }

  // Poll post: parse the poll options from JSON body
  if (type === "poll") {
    const parsedPoll = typeof poll === "string" ? JSON.parse(poll) : poll;
    if (!parsedPoll?.options || parsedPoll.options.length < 2) {
      throw new ApiError(400, "Polls must have at least 2 options");
    }
    postData.poll = {
      options: parsedPoll.options.map((text) => ({ text, votes: 0 })),
      voters: [],
    };
  }

  const post = await Post.create(postData);
  await post.populate("owner", "username fullName avatar");

  return res.status(201).json(new ApiResponse(201, post, "Post created"));
});

// ========================================================================
// POST /api/v1/posts/:id/vote
// Vote on a poll option. Each user can only vote once.
// ========================================================================
export const votePoll = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { optionIndex } = req.body;

  const post = await Post.findById(id);
  if (!post) throw new ApiError(404, "Post not found");
  if (post.type !== "poll") throw new ApiError(400, "This post is not a poll");

  const idx = Number(optionIndex);
  if (idx < 0 || idx >= post.poll.options.length) {
    throw new ApiError(400, "Invalid option index");
  }

  // Check if user already voted
  const alreadyVoted = post.poll.voters.find(
    (v) => v.user.toString() === req.user._id.toString()
  );
  if (alreadyVoted) throw new ApiError(400, "You have already voted on this poll");

  // Increment the vote count for the chosen option
  post.poll.options[idx].votes += 1;
  post.poll.voters.push({ user: req.user._id, optionIndex: idx });
  await post.save();

  return res.status(200).json(new ApiResponse(200, post.poll, "Vote recorded"));
});

// ========================================================================
// PATCH /api/v1/posts/:id
// Edit a post's content (only text posts can be edited, not images/polls).
// ========================================================================
export const updatePost = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { content } = req.body;

  const post = await Post.findById(id);
  if (!post) throw new ApiError(404, "Post not found");
  if (post.owner.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You can only edit your own posts");
  }

  if (content) {
    post.content = content.trim();
    post.tags = extractHashtags(content);
  }
  await post.save();

  return res.status(200).json(new ApiResponse(200, post, "Post updated"));
});

// ========================================================================
// DELETE /api/v1/posts/:id
// ========================================================================
export const deletePost = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const post = await Post.findById(id);
  if (!post) throw new ApiError(404, "Post not found");

  const isOwner = post.owner.toString() === req.user._id.toString();
  const isStaff = ["moderator", "admin"].includes(req.user.role);
  if (!isOwner && !isStaff) throw new ApiError(403, "Not allowed to delete this post");

  await Post.findByIdAndDelete(id);
  await Comment.deleteMany({ contentId: id, contentType: "Post" });
  await Like.deleteMany({ contentId: id, contentType: "Post" });

  return res.status(200).json(new ApiResponse(200, {}, "Post deleted"));
});

// -----------------------------------------------------------------------
// Helper: extract hashtags from post content
// Example: "Hello #world, this is #cool" -> ["world", "cool"]
// -----------------------------------------------------------------------
const extractHashtags = (content) => {
  const matches = content.match(/#(\w+)/g);
  return matches ? matches.map((tag) => tag.slice(1).toLowerCase()) : [];
};
