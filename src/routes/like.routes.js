import { Router } from "express";
import { toggleLike, getLikedVideos } from "../controllers/like.controller.js";
import { verifyJWT } from "../middleware/auth.middleware.js";

const router = Router();
router.get("/videos", verifyJWT, getLikedVideos);
router.post("/:contentType/:contentId", verifyJWT, toggleLike);
export default router;
