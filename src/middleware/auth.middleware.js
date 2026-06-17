// -----------------------------------------------------------------------
// auth.middleware.js
// "verifyJWT" protects routes that require a logged-in user.
//
// HOW IT WORKS:
// 1. The frontend sends the access token either in:
//      - the "Authorization: Bearer <token>" header, OR
//      - an httpOnly cookie named "accessToken"
// 2. We verify the token's signature using ACCESS_TOKEN_SECRET.
// 3. If valid, we look up the user in the database and attach it to
//    req.user so later controllers know WHO is making the request.
// 4. If invalid/missing, we throw a 401 Unauthorized error.
//
// USAGE: router.get("/me", verifyJWT, getCurrentUser)
// -----------------------------------------------------------------------

import jwt from "jsonwebtoken";
import { User } from "../models/User.model.js";
import { ApiError } from "../utils/apiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";

export const verifyJWT = asyncHandler(async (req, res, next) => {
  const token =
    req.cookies?.accessToken ||
    req.header("Authorization")?.replace("Bearer ", "");

  if (!token) {
    throw new ApiError(401, "Unauthorized request - no token provided");
  }

  const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

  const user = await User.findById(decoded._id).select("-password -refreshToken");

  if (!user) {
    throw new ApiError(401, "Invalid access token - user not found");
  }

  req.user = user;
  next();
});

// -----------------------------------------------------------------------
// attachUserIfPresent - for routes that work for BOTH guests and logged-in
// users (e.g. viewing a video) but behave slightly differently if logged in.
// Does NOT throw if there's no token - just leaves req.user as null.
// -----------------------------------------------------------------------
export const attachUserIfPresent = asyncHandler(async (req, res, next) => {
  const token =
    req.cookies?.accessToken ||
    req.header("Authorization")?.replace("Bearer ", "");

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    const user = await User.findById(decoded._id).select("-password -refreshToken");
    req.user = user || null;
  } catch (error) {
    req.user = null;
  }

  next();
});
