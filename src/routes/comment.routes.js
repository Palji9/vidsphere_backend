import { Router } from "express";
import { getComments, getReplies, addComment, addReply, updateComment, deleteComment, togglePinComment } from "../controllers/comment.controller.js";
import { verifyJWT, attachUserIfPresent } from "../middleware/auth.middleware.js";

const router = Router();
router.get("/:contentType/:contentId", attachUserIfPresent, getComments);
router.get("/:contentType/:contentId/replies/:commentId", getReplies);
router.post("/:contentType/:contentId", verifyJWT, addComment);
router.post("/:contentType/:contentId/replies/:commentId", verifyJWT, addReply);
router.patch("/:commentId", verifyJWT, updateComment);
router.delete("/:commentId", verifyJWT, deleteComment);
router.post("/:commentId/pin", verifyJWT, togglePinComment);
export default router;
