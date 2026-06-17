// -----------------------------------------------------------------------
// video.routes.js
// -----------------------------------------------------------------------

import { Router } from "express";
import {
  publishVideo,
  getAllVideos,
  getTrendingVideos,
  getVideosByCategory,
  getSubscriptionFeed,
  getVideoById,
  getRelatedVideos,
  updateVideo,
  deleteVideo,
} from "../controllers/video.controller.js";
import { verifyJWT, attachUserIfPresent } from "../middleware/auth.middleware.js";
import { uploadVideo, uploadImage } from "../middleware/multer.middleware.js";

const router = Router();

// --- Public / optional-auth routes ---
router.get("/", attachUserIfPresent, getAllVideos);
router.get("/trending", getTrendingVideos);
router.get("/category/:slug", getVideosByCategory);
router.get("/subscriptions", verifyJWT, getSubscriptionFeed);

// NOTE: named routes (/trending, /category/:slug, /subscriptions) MUST come
// before the dynamic /:id route, otherwise Express will treat "trending"
// as a video ID and go to getVideoById.
router.get("/:id", attachUserIfPresent, getVideoById);
router.get("/:id/related", getRelatedVideos);

// --- Protected routes (login required) ---
router.post("/", verifyJWT, uploadVideo, publishVideo);
router.patch("/:id", verifyJWT, uploadImage.single("thumbnail"), updateVideo);
router.delete("/:id", verifyJWT, deleteVideo);

export default router;
