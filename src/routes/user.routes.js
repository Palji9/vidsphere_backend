// -----------------------------------------------------------------------
// user.routes.js
// -----------------------------------------------------------------------

import { Router } from "express";
import {
  getChannelProfile,
  updateProfile,
  updateAvatar,
  updateCoverImage,
  getWatchHistory,
  clearWatchHistory,
  removeFromWatchHistory,
  getSuggestedChannels,
} from "../controllers/user.controller.js";
import { verifyJWT, attachUserIfPresent } from "../middleware/auth.middleware.js";
import { uploadAvatar, uploadImage } from "../middleware/multer.middleware.js";

const router = Router();

// --- "Me" routes (require login) - placed BEFORE /:username so that
// the literal string "me" doesn't get matched as a username param. ---
router.patch("/me", verifyJWT, updateProfile);
router.patch("/me/avatar", verifyJWT, uploadAvatar.single("avatar"), updateAvatar);
router.patch("/me/cover", verifyJWT, uploadImage.single("cover"), updateCoverImage);
router.get("/me/history", verifyJWT, getWatchHistory);
router.delete("/me/history", verifyJWT, clearWatchHistory);
router.delete("/me/history/:videoId", verifyJWT, removeFromWatchHistory);
router.get("/suggestions", verifyJWT, getSuggestedChannels);

// --- Public channel profile (optional auth - shows subscribe state if logged in) ---
router.get("/:username", attachUserIfPresent, getChannelProfile);

export default router;
