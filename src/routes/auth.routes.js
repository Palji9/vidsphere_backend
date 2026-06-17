// -----------------------------------------------------------------------
// auth.routes.js
// Defines all /api/v1/auth/* endpoints and connects them to controller
// functions. Routes that need a logged-in user use verifyJWT middleware.
// -----------------------------------------------------------------------

import { Router } from "express";
import {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  getCurrentUser,
} from "../controllers/auth.controller.js";
import { verifyJWT } from "../middleware/auth.middleware.js";

const router = Router();

// Public routes (no login required)
router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/refresh", refreshAccessToken);

// Protected routes (require a valid access token)
router.post("/logout", verifyJWT, logoutUser);
router.get("/me", verifyJWT, getCurrentUser);

export default router;
