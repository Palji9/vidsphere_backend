import { Router } from "express";
import { getShortsFeed, getShortById, publishShort, updateShort, deleteShort } from "../controllers/short.controller.js";
import { verifyJWT, attachUserIfPresent } from "../middleware/auth.middleware.js";
import { uploadShort } from "../middleware/multer.middleware.js";

const router = Router();
router.get("/", attachUserIfPresent, getShortsFeed);
router.get("/:id", attachUserIfPresent, getShortById);
router.post("/", verifyJWT, uploadShort, publishShort);
router.patch("/:id", verifyJWT, updateShort);
router.delete("/:id", verifyJWT, deleteShort);
export default router;
