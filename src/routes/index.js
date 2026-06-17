// -----------------------------------------------------------------------
// routes/index.js
// Central router: mounts all feature routers under /api/v1.
// Import this one file in app.js to register everything.
// -----------------------------------------------------------------------

import { Router } from "express";
import authRoutes from "./auth.routes.js";
import userRoutes from "./user.routes.js";
import videoRoutes from "./video.routes.js";
import shortRoutes from "./short.routes.js";
import postRoutes from "./post.routes.js";
import commentRoutes from "./comment.routes.js";
import likeRoutes from "./like.routes.js";
import subscriptionRoutes from "./subscription.routes.js";
import playlistRoutes from "./playlist.routes.js";
import messageRoutes from "./message.routes.js";
import notificationRoutes from "./notification.routes.js";
import searchRoutes from "./search.routes.js";
import studioRoutes from "./studio.routes.js";
import liveRoutes from "./live.routes.js";
import adminRoutes from "./admin.routes.js";

const router = Router();

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/videos", videoRoutes);
router.use("/shorts", shortRoutes);
router.use("/posts", postRoutes);
router.use("/comments", commentRoutes);
router.use("/likes", likeRoutes);
router.use("/subscriptions", subscriptionRoutes);
router.use("/playlists", playlistRoutes);
router.use("/conversations", messageRoutes);
router.use("/notifications", notificationRoutes);
router.use("/search", searchRoutes);
router.use("/studio", studioRoutes);
router.use("/live", liveRoutes);
router.use("/admin", adminRoutes);

export default router;
