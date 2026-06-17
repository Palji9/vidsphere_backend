import { Router } from "express";
import { getNotifications, getUnreadCount, markAsRead, markAllAsRead, deleteNotification, clearAllNotifications } from "../controllers/notification.controller.js";
import { verifyJWT } from "../middleware/auth.middleware.js";

const router = Router();
router.get("/", verifyJWT, getNotifications);
router.get("/unread-count", verifyJWT, getUnreadCount);
router.post("/read", verifyJWT, markAsRead);
router.post("/read-all", verifyJWT, markAllAsRead);
router.delete("/:id", verifyJWT, deleteNotification);
router.delete("/", verifyJWT, clearAllNotifications);
export default router;
