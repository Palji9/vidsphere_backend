import { Router } from "express";
import { getPlatformStats, getAllUsers, changeUserRole, deleteUser, getReports, resolveReport, getAuditLog } from "../controllers/admin.controller.js";
import { verifyJWT } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/role.middleware.js";

const router = Router();
// All admin routes require login AND admin role
router.use(verifyJWT, authorize("admin"));
router.get("/stats", getPlatformStats);
router.get("/users", getAllUsers);
router.patch("/users/:id/role", changeUserRole);
router.delete("/users/:id", deleteUser);
router.get("/reports", getReports);
router.patch("/reports/:id", resolveReport);
router.get("/audit", getAuditLog);
export default router;
