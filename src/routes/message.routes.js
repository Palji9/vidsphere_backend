import { Router } from "express";
import { getConversations, createConversation, getMessages, sendMessage, deleteMessage } from "../controllers/message.controller.js";
import { verifyJWT } from "../middleware/auth.middleware.js";

const router = Router();
router.get("/", verifyJWT, getConversations);
router.post("/", verifyJWT, createConversation);
router.get("/:id/messages", verifyJWT, getMessages);
router.post("/:id/messages", verifyJWT, sendMessage);
router.delete("/messages/:messageId", verifyJWT, deleteMessage);
export default router;
