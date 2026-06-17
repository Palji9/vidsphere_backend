// -----------------------------------------------------------------------
// user.controller.js
// Handles user profile operations: viewing a channel's public profile,
// updating your own profile/avatar/banner, watch history, and the
// "recommended channels" feature.
//
// Remember: in this codebase, "User" and "Channel" are the SAME model.
// Visiting /channel/:username shows that user's public profile.
// -----------------------------------------------------------------------

import { User } from "../models/User.model.js";
import { Subscription } from "../models/Subscription.model.js";
import { Video } from "../models/Video.model.js";
import { ApiError, ApiResponse } from "../utils/apiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";

// ========================================================================
// GET /api/v1/users/:username
// Public profile / channel page data.
// ========================================================================
export const getChannelProfile = asyncHandler(async (req, res) => {
  const { username } = req.params;

  const channel = await User.findOne({ username: username.toLowerCase() }).select(
    "-password -refreshToken -watchHistory"
  );

  if (!channel) {
    throw new ApiError(404, "Channel not found");
  }

  // Count subscribers (people subscribed TO this channel)
  const subscriberCount = await Subscription.countDocuments({ channel: channel._id });

  // Count how many channels THIS user is subscribed to
  const subscribedToCount = await Subscription.countDocuments({ subscriber: channel._id });

  // If the requester is logged in, check whether they're subscribed
  // to this channel (so the frontend can show "Subscribe" vs "Subscribed").
  let isSubscribed = false;
  if (req.user) {
    const sub = await Subscription.findOne({
      subscriber: req.user._id,
      channel: channel._id,
    });
    isSubscribed = !!sub;
  }

  // Total video count for this channel (only public videos if it's not the owner)
  const videoFilter = { owner: channel._id };
  if (!req.user || req.user._id.toString() !== channel._id.toString()) {
    videoFilter.visibility = "public";
  }
  const videoCount = await Video.countDocuments(videoFilter);

  return res.status(200).json(
    new ApiResponse(200, {
      ...channel.toObject(),
      subscriberCount,
      subscribedToCount,
      videoCount,
      isSubscribed,
    })
  );
});

// ========================================================================
// PATCH /api/v1/users/me
// Update text fields on your own profile (fullName, bio).
// Requires verifyJWT.
// ========================================================================
export const updateProfile = asyncHandler(async (req, res) => {
  const { fullName, bio } = req.body;

  if (!fullName && bio === undefined) {
    throw new ApiError(400, "Provide at least one field to update (fullName, bio)");
  }

  const updateFields = {};
  if (fullName) updateFields.fullName = fullName;
  if (bio !== undefined) updateFields.bio = bio;

  const updatedUser = await User.findByIdAndUpdate(
    req.user._id,
    { $set: updateFields },
    { new: true } // return the document AFTER update
  ).select("-password -refreshToken");

  return res.status(200).json(new ApiResponse(200, updatedUser, "Profile updated"));
});

// ========================================================================
// PATCH /api/v1/users/me/avatar
// Updates avatar - expects multer to have processed a single image file
// at req.file (see routes file for middleware setup).
// ========================================================================
export const updateAvatar = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, "Avatar image file is required");
  }

  // Build a public URL path. Since express.static serves the "public"
  // folder, a file saved to public/uploads/avatars/xyz.jpg becomes
  // accessible at /uploads/avatars/xyz.jpg
  const avatarUrl = `/uploads/avatars/${req.file.filename}`;

  const updatedUser = await User.findByIdAndUpdate(
    req.user._id,
    { $set: { avatar: avatarUrl } },
    { new: true }
  ).select("-password -refreshToken");

  return res.status(200).json(new ApiResponse(200, updatedUser, "Avatar updated"));
});

// ========================================================================
// PATCH /api/v1/users/me/cover
// Updates the channel banner/cover image.
// ========================================================================
export const updateCoverImage = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, "Cover image file is required");
  }

  const coverUrl = `/uploads/images/${req.file.filename}`;

  const updatedUser = await User.findByIdAndUpdate(
    req.user._id,
    { $set: { coverImage: coverUrl } },
    { new: true }
  ).select("-password -refreshToken");

  return res.status(200).json(new ApiResponse(200, updatedUser, "Cover image updated"));
});

// ========================================================================
// GET /api/v1/users/me/history
// Returns the current user's watch history (most recently watched first).
// ========================================================================
export const getWatchHistory = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).populate({
    path: "watchHistory",
    populate: { path: "owner", select: "username fullName avatar" },
    options: { sort: { _id: -1 } }, // Mongoose populate doesn't guarantee array order by default
  });

  return res.status(200).json(new ApiResponse(200, user.watchHistory, "Watch history fetched"));
});

// ========================================================================
// DELETE /api/v1/users/me/history
// Clears the entire watch history.
// ========================================================================
export const clearWatchHistory = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, { $set: { watchHistory: [] } });
  return res.status(200).json(new ApiResponse(200, {}, "Watch history cleared"));
});

// ========================================================================
// DELETE /api/v1/users/me/history/:videoId
// Removes a single video from watch history.
// ========================================================================
export const removeFromWatchHistory = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  await User.findByIdAndUpdate(req.user._id, { $pull: { watchHistory: videoId } });
  return res.status(200).json(new ApiResponse(200, {}, "Removed from watch history"));
});

// ========================================================================
// GET /api/v1/users/suggestions
// Suggests channels the user might want to subscribe to.
// Simple algorithm: channels with the most subscribers that the
// current user ISN'T already subscribed to.
// ========================================================================
export const getSuggestedChannels = asyncHandler(async (req, res) => {
  // Find IDs of channels the user already follows so we can exclude them
  const alreadySubscribed = await Subscription.find({ subscriber: req.user._id }).select("channel");
  const excludeIds = alreadySubscribed.map((s) => s.channel);
  excludeIds.push(req.user._id); // never suggest yourself

  // Aggregate: join with subscriptions to count subscribers per channel,
  // then sort by subscriber count descending.
  const suggestions = await User.aggregate([
    { $match: { _id: { $nin: excludeIds }, role: { $in: ["creator", "user"] } } },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "subs",
      },
    },
    {
      $addFields: { subscriberCount: { $size: "$subs" } },
    },
    { $sort: { subscriberCount: -1 } },
    { $limit: 10 },
    {
      $project: {
        username: 1,
        fullName: 1,
        avatar: 1,
        bio: 1,
        subscriberCount: 1,
      },
    },
  ]);

  return res.status(200).json(new ApiResponse(200, suggestions, "Suggested channels fetched"));
});
