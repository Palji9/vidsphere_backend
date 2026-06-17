import { Router } from "express";
import { getStudioOverview, getStudioVideos, getVideoAnalytics, getStudioComments } from "../controllers/studio.controller.js";
import { verifyJWT } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/role.middleware.js";

const router = Router();
// Studio requires login AND the "creator" or "admin" role
router.use(verifyJWT, authorize("creator", "admin"));
router.get("/overview", getStudioOverview);
router.get("/videos", getStudioVideos);
router.get("/videos/:id/analytics", getVideoAnalytics);
router.get("/comments", getStudioComments);
export default router;
