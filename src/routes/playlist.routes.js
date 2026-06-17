import { Router } from "express";
import { getMyPlaylists, getPlaylistById, createPlaylist, updatePlaylist, deletePlaylist, addVideoToPlaylist, removeVideoFromPlaylist, reorderPlaylist } from "../controllers/playlist.controller.js";
import { verifyJWT, attachUserIfPresent } from "../middleware/auth.middleware.js";

const router = Router();
router.get("/me", verifyJWT, getMyPlaylists);
router.post("/", verifyJWT, createPlaylist);
router.get("/:id", attachUserIfPresent, getPlaylistById);
router.patch("/:id", verifyJWT, updatePlaylist);
router.delete("/:id", verifyJWT, deletePlaylist);
router.post("/:id/videos", verifyJWT, addVideoToPlaylist);
router.delete("/:id/videos/:videoId", verifyJWT, removeVideoFromPlaylist);
router.put("/:id/order", verifyJWT, reorderPlaylist);
export default router;
