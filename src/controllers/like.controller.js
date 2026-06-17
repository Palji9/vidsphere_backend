// -----------------------------------------------------------------------
// like.controller.js
// Toggle likes for Videos, Shorts, Posts, and Comments.
// "Toggle" means: if you haven't liked it -> add like,
//                 if you already liked it  -> remove like (unlike).
// -----------------------------------------------------------------------

import { Like } from "../models/Like.model.js";
import { ApiError, ApiResponse } from "../utils/apiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";

const VALID_TYPES = ["Video", "Short", "Post", "Comment"];

// ========================================================================
// POST /api/v1/likes/:contentType/:contentId
// Toggle like on any content type.
// ========================================================================
export const toggleLike = asyncHandler(async (req, res) => {
  const { contentType, contentId } = req.params;

  if (!VALID_TYPES.includes(contentType)) {
    throw new ApiError(400, `Invalid contentType. Must be one of: ${VALID_TYPES.join(", ")}`);
  }

  // Try to find an existing like document from this user on this content
  const existingLike = await Like.findOne({
    likedBy: req.user._id,
    contentId,
    contentType,
  });

  let isLiked;
  if (existingLike) {
    // Already liked -> remove the like document (unlike)
    await Like.findByIdAndDelete(existingLike._id);
    isLiked = false;
  } else {
    // Not yet liked -> create a like document
    await Like.create({ likedBy: req.user._id, contentId, contentType });
    isLiked = true;
  }

  // Count total likes for updated display count
  const likesCount = await Like.countDocuments({ contentId, contentType });

  return res.status(200).json(
    new ApiResponse(200, { isLiked, likesCount }, isLiked ? "Liked" : "Unliked")
  );
});

// ========================================================================
// GET /api/v1/likes/videos
// Returns all videos the current user has liked (Liked Videos page).
// ========================================================================
export const getLikedVideos = asyncHandler(async (req, res) => {
  const likedVideos = await Like.find({
    likedBy: req.user._id,
    contentType: "Video",
  })
    .sort({ createdAt: -1 })
    .populate({
      path: "contentId",
      model: "Video",
      populate: { path: "owner", select: "username fullName avatar" },
    });

  // Filter out any nulls (videos that were deleted after being liked)
  const videos = likedVideos
    .filter((l) => l.contentId !== null)
    .map((l) => l.contentId);

  return res.status(200).json(new ApiResponse(200, videos, "Liked videos fetched"));
});
