import { Router } from "express";
import { getSocialFeed, getChannelPosts, createPost, votePoll, updatePost, deletePost } from "../controllers/post.controller.js";
import { verifyJWT } from "../middleware/auth.middleware.js";
import { uploadPostImages } from "../middleware/multer.middleware.js";

const router = Router();
router.get("/feed", verifyJWT, getSocialFeed);
router.get("/channel/:channelId", getChannelPosts);
router.post("/", verifyJWT, uploadPostImages, createPost);
router.post("/:id/vote", verifyJWT, votePoll);
router.patch("/:id", verifyJWT, updatePost);
router.delete("/:id", verifyJWT, deletePost);
export default router;
