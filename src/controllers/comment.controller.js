// -----------------------------------------------------------------------
// comment.controller.js
// Comments work for Videos, Shorts, AND Posts via the polymorphic
// Comment model. The `contentType` param in the URL tells us which.
//
// Route pattern: /api/v1/comments/:contentType/:contentId
//   e.g. GET /api/v1/comments/Video/abc123
//        POST /api/v1/comments/Short/abc123
// -----------------------------------------------------------------------

import { Comment } from "../models/Comment.model.js";
import { Like } from "../models/Like.model.js";
import { ApiError, ApiResponse } from "../utils/apiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import { getPagination, buildPaginatedResponse } from "../utils/pagination.js";
import mongoose from "mongoose";

const VALID_TYPES = ["Video", "Short", "Post"];

// ========================================================================
// GET /api/v1/comments/:contentType/:contentId
// Get top-level comments for a piece of content, with reply counts.
// ========================================================================
export const getComments = asyncHandler(async (req, res) => {
  const { contentType, contentId } = req.params;
  const { page, limit, skip } = getPagination(req);
  const sort = req.query.sort || "top"; // "top" (most likes) or "new"

  if (!VALID_TYPES.includes(contentType)) {
    throw new ApiError(400, `Invalid contentType. Must be one of: ${VALID_TYPES.join(", ")}`);
  }

  // Only fetch top-level comments (parentComment is null)
  const filter = { contentId, contentType, parentComment: null };
  const sortOrder = sort === "new" ? { createdAt: -1 } : { isPinned: -1, createdAt: -1 };

  const [comments, total] = await Promise.all([
    Comment.find(filter)
      .sort(sortOrder)
      .skip(skip)
      .limit(limit)
      .populate("owner", "username fullName avatar"),
    Comment.countDocuments(filter),
  ]);

  // For each comment, get its reply count and like count
  const enriched = await Promise.all(
    comments.map(async (comment) => {
      const [replyCount, likeCount, isLiked] = await Promise.all([
        Comment.countDocuments({ parentComment: comment._id }),
        Like.countDocuments({ contentId: comment._id, contentType: "Comment" }),
        req.user
          ? Like.exists({ likedBy: req.user._id, contentId: comment._id, contentType: "Comment" })
          : Promise.resolve(false),
      ]);
      return { ...comment.toObject(), replyCount, likeCount, isLiked: !!isLiked };
    })
  );

  return res.status(200).json(
    new ApiResponse(200, buildPaginatedResponse(enriched, total, page, limit))
  );
});

// ========================================================================
// GET /api/v1/comments/:contentType/:contentId/replies/:commentId
// Get replies (child comments) for a parent comment.
// ========================================================================
export const getReplies = asyncHandler(async (req, res) => {
  const { commentId } = req.params;

  const replies = await Comment.find({ parentComment: commentId })
    .sort({ createdAt: 1 }) // replies shown oldest-first (chronological)
    .populate("owner", "username fullName avatar");

  return res.status(200).json(new ApiResponse(200, replies, "Replies fetched"));
});

// ========================================================================
// POST /api/v1/comments/:contentType/:contentId
// Add a top-level comment to a video/short/post.
// ========================================================================
export const addComment = asyncHandler(async (req, res) => {
  const { contentType, contentId } = req.params;
  const { content } = req.body;

  if (!VALID_TYPES.includes(contentType)) {
    throw new ApiError(400, "Invalid contentType");
  }
  if (!content?.trim()) {
    throw new ApiError(400, "Comment content is required");
  }

  const comment = await Comment.create({
    content: content.trim(),
    owner: req.user._id,
    contentId,
    contentType,
    parentComment: null,
  });

  await comment.populate("owner", "username fullName avatar");

  return res.status(201).json(new ApiResponse(201, comment, "Comment added"));
});

// ========================================================================
// POST /api/v1/comments/:contentType/:contentId/replies/:commentId
// Reply to an existing comment.
// ========================================================================
export const addReply = asyncHandler(async (req, res) => {
  const { contentType, contentId, commentId } = req.params;
  const { content } = req.body;

  if (!content?.trim()) {
    throw new ApiError(400, "Reply content is required");
  }

  // Verify the parent comment exists
  const parentComment = await Comment.findById(commentId);
  if (!parentComment) {
    throw new ApiError(404, "Parent comment not found");
  }

  // Prevent deep nesting: if the parent is already a reply, block it.
  // We only support one level of nesting (comment -> reply).
  if (parentComment.parentComment !== null) {
    throw new ApiError(400, "Cannot reply to a reply (max 1 level of nesting)");
  }

  const reply = await Comment.create({
    content: content.trim(),
    owner: req.user._id,
    contentId,
    contentType,
    parentComment: commentId,
  });

  await reply.populate("owner", "username fullName avatar");

  return res.status(201).json(new ApiResponse(201, reply, "Reply added"));
});

// ========================================================================
// PATCH /api/v1/comments/:commentId
// Edit your own comment.
// ========================================================================
export const updateComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  const { content } = req.body;

  if (!content?.trim()) {
    throw new ApiError(400, "Content is required");
  }

  const comment = await Comment.findById(commentId);
  if (!comment) {
    throw new ApiError(404, "Comment not found");
  }
  if (comment.owner.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You can only edit your own comments");
  }

  comment.content = content.trim();
  await comment.save();

  return res.status(200).json(new ApiResponse(200, comment, "Comment updated"));
});

// ========================================================================
// DELETE /api/v1/comments/:commentId
// Delete a comment. Owner, moderators, and admins can delete.
// ========================================================================
export const deleteComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;

  const comment = await Comment.findById(commentId);
  if (!comment) {
    throw new ApiError(404, "Comment not found");
  }

  const isOwner = comment.owner.toString() === req.user._id.toString();
  const isStaff = ["moderator", "admin"].includes(req.user.role);

  if (!isOwner && !isStaff) {
    throw new ApiError(403, "Not allowed to delete this comment");
  }

  // Delete the comment and all its replies
  await Comment.deleteMany({
    $or: [{ _id: commentId }, { parentComment: commentId }],
  });

  // Clean up likes on the comment (and its replies)
  await Like.deleteMany({ contentId: commentId, contentType: "Comment" });

  return res.status(200).json(new ApiResponse(200, {}, "Comment deleted"));
});

// ========================================================================
// POST /api/v1/comments/:commentId/pin
// Pin/unpin a comment (toggle). Only the content owner can pin.
// ========================================================================
export const togglePinComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;

  const comment = await Comment.findById(commentId);
  if (!comment) {
    throw new ApiError(404, "Comment not found");
  }

  // Toggle pin status
  comment.isPinned = !comment.isPinned;
  await comment.save();

  return res
    .status(200)
    .json(new ApiResponse(200, { isPinned: comment.isPinned }, "Pin status toggled"));
});
