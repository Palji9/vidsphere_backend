import { Router } from "express";
import { getActiveStreams, getStreamById, createStream, startStream, endStream, deleteStream } from "../controllers/live.controller.js";
import { verifyJWT } from "../middleware/auth.middleware.js";

const router = Router();
router.get("/", getActiveStreams);
router.get("/:id", getStreamById);
router.post("/", verifyJWT, createStream);
router.post("/:id/start", verifyJWT, startStream);
router.post("/:id/end", verifyJWT, endStream);
router.delete("/:id", verifyJWT, deleteStream);
export default router;
