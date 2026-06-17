import { Router } from "express";
import { toggleSubscription, updateNotifyPreference, getSubscribers, getMySubscriptions } from "../controllers/subscription.controller.js";
import { verifyJWT } from "../middleware/auth.middleware.js";

const router = Router();
router.get("/my-channels", verifyJWT, getMySubscriptions);
router.get("/:channelId/subscribers", getSubscribers);
router.post("/:channelId/toggle", verifyJWT, toggleSubscription);
router.patch("/:channelId/notify", verifyJWT, updateNotifyPreference);
export default router;
