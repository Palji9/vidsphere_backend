// -----------------------------------------------------------------------
// role.middleware.js
// "authorize" enforces Role-Based Access Control (RBAC).
//
// USAGE: router.delete("/videos/:id", verifyJWT, authorize("admin"), deleteVideo)
//
// This MUST run AFTER verifyJWT (so req.user already exists).
// It checks if req.user.role is one of the allowed roles passed in.
// If not, it throws a 403 Forbidden error.
//
// Example - only admins can access admin routes:
//   authorize("admin")
//
// Example - moderators AND admins can resolve reports:
//   authorize("moderator", "admin")
// -----------------------------------------------------------------------

import { ApiError } from "../utils/apiResponse.js";

export const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      throw new ApiError(401, "Unauthorized - please log in");
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw new ApiError(
        403,
        `Forbidden - this action requires one of these roles: ${allowedRoles.join(", ")}`
      );
    }

    next();
  };
};
