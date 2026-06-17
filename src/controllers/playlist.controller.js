// -----------------------------------------------------------------------
// playlist.controller.js
// Create, read, update, delete playlists. Add/remove/reorder videos.
// -----------------------------------------------------------------------

import { Playlist } from "../models/Playlist.model.js";
import { ApiError, ApiResponse } from "../utils/apiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";

// GET /api/v1/playlists/me - all playlists owned by current user
export const getMyPlaylists = asyncHandler(async (req, res) => {
  const playlists = await Playlist.find({ owner: req.user._id })
    .sort({ createdAt: -1 });
  return res.status(200).json(new ApiResponse(200, playlists));
});

// GET /api/v1/playlists/:id - single playlist with its videos populated
export const getPlaylistById = asyncHandler(async (req, res) => {
  const playlist = await Playlist.findById(req.params.id)
    .populate({ path: "videos", populate: { path: "owner", select: "username fullName avatar" } });

  if (!playlist) throw new ApiError(404, "Playlist not found");

  // Private playlists visible only to the owner
  if (playlist.visibility === "private") {
    if (!req.user || playlist.owner.toString() !== req.user._id.toString()) {
      throw new ApiError(403, "This playlist is private");
    }
  }

  return res.status(200).json(new ApiResponse(200, playlist));
});

// POST /api/v1/playlists - create a new playlist
export const createPlaylist = asyncHandler(async (req, res) => {
  const { name, description, visibility } = req.body;
  if (!name) throw new ApiError(400, "Playlist name is required");

  const playlist = await Playlist.create({
    owner: req.user._id,
    name,
    description: description || "",
    visibility: visibility || "private",
  });

  return res.status(201).json(new ApiResponse(201, playlist, "Playlist created"));
});

// PATCH /api/v1/playlists/:id - edit name, description, visibility
export const updatePlaylist = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const playlist = await Playlist.findById(id);

  if (!playlist) throw new ApiError(404, "Playlist not found");
  if (playlist.owner.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You can only edit your own playlists");
  }

  const { name, description, visibility } = req.body;
  if (name) playlist.name = name;
  if (description !== undefined) playlist.description = description;
  if (visibility) playlist.visibility = visibility;

  await playlist.save();
  return res.status(200).json(new ApiResponse(200, playlist, "Playlist updated"));
});

// DELETE /api/v1/playlists/:id
export const deletePlaylist = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const playlist = await Playlist.findById(id);

  if (!playlist) throw new ApiError(404, "Playlist not found");
  if (playlist.owner.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "Not allowed to delete this playlist");
  }

  await Playlist.findByIdAndDelete(id);
  return res.status(200).json(new ApiResponse(200, {}, "Playlist deleted"));
});

// POST /api/v1/playlists/:id/videos - add a video to a playlist
export const addVideoToPlaylist = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { videoId } = req.body;

  const playlist = await Playlist.findById(id);
  if (!playlist) throw new ApiError(404, "Playlist not found");
  if (playlist.owner.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "Not allowed to modify this playlist");
  }
  if (playlist.videos.includes(videoId)) {
    throw new ApiError(409, "Video is already in this playlist");
  }

  playlist.videos.push(videoId);
  await playlist.save();

  return res.status(200).json(new ApiResponse(200, playlist, "Video added to playlist"));
});

// DELETE /api/v1/playlists/:id/videos/:videoId - remove a video
export const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
  const { id, videoId } = req.params;
  const playlist = await Playlist.findById(id);

  if (!playlist) throw new ApiError(404, "Playlist not found");
  if (playlist.owner.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "Not allowed to modify this playlist");
  }

  // $pull removes the videoId from the videos array
  await Playlist.findByIdAndUpdate(id, { $pull: { videos: videoId } });

  return res.status(200).json(new ApiResponse(200, {}, "Video removed from playlist"));
});

// PUT /api/v1/playlists/:id/order - reorder videos
// Body: { videoIds: ["id1", "id2", "id3"] } in the desired new order
export const reorderPlaylist = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { videoIds } = req.body;

  if (!Array.isArray(videoIds)) throw new ApiError(400, "videoIds must be an array");

  const playlist = await Playlist.findById(id);
  if (!playlist) throw new ApiError(404, "Playlist not found");
  if (playlist.owner.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "Not allowed to modify this playlist");
  }

  // Replace the videos array with the new order
  playlist.videos = videoIds;
  await playlist.save();

  return res.status(200).json(new ApiResponse(200, playlist, "Playlist reordered"));
});
