// -----------------------------------------------------------------------
// auth.controller.js
// Handles user registration, login, logout, and token refresh.
//
// AUTH FLOW SUMMARY:
// 1. Register -> creates a User document (password gets hashed automatically
//    by the pre-save hook in User.model.js)
// 2. Login -> verifies password, generates an access token (short-lived,
//    15 min) and a refresh token (long-lived, 7 days)
//    - access token  -> sent in response body (frontend stores in Redux)
//    - refresh token -> stored in an httpOnly cookie (can't be read by JS,
//      protecting it from XSS attacks) AND saved on the User document
// 3. Refresh -> when the access token expires, the frontend calls this
//    endpoint (the httpOnly cookie is sent automatically by the browser).
//    We verify the refresh token and issue a new access token.
// 4. Logout -> clears the refresh token from both the cookie and the DB,
//    effectively ending the session.
// -----------------------------------------------------------------------

import jwt from "jsonwebtoken";
import { User } from "../models/User.model.js";
import { ApiError, ApiResponse } from "../utils/apiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";

// Cookie options shared by login/refresh/logout.
// httpOnly: true   -> JavaScript on the frontend CANNOT read this cookie (XSS protection)
// secure: true     -> only sent over HTTPS (enable in production)
// sameSite: "lax"  -> sent on top-level navigation, helps prevent CSRF
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
};

// Small helper: generates both tokens for a user, saves the refresh
// token to the DB, and returns both tokens.
const generateTokens = async (user) => {
  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();

  user.refreshToken = refreshToken;
  // validateBeforeSave: false -> skip running full schema validation
  // again (we're only updating one field, no need to re-check password etc.)
  await user.save({ validateBeforeSave: false });

  return { accessToken, refreshToken };
};

// ========================================================================
// POST /api/v1/auth/register
// ========================================================================
export const registerUser = asyncHandler(async (req, res) => {
  const { username, email, password, fullName } = req.body;

  // Basic presence validation (deeper validation happens via Zod schemas
  // in validations/ - kept simple here for readability)
  if (!username || !email || !password || !fullName) {
    throw new ApiError(400, "All fields are required: username, email, password, fullName");
  }

  // Check if a user with this email or username already exists.
  const existingUser = await User.findOne({
    $or: [{ username: username.toLowerCase() }, { email: email.toLowerCase() }],
  });

  if (existingUser) {
    throw new ApiError(409, "A user with this username or email already exists");
  }

  // Create the user. The password gets hashed automatically by the
  // pre("save") hook we defined in User.model.js.
  const user = await User.create({
    username: username.toLowerCase(),
    email: email.toLowerCase(),
    password,
    fullName,
  });

  // Immediately log the user in by generating tokens (smooth UX -
  // no need to register then separately login).
  const { accessToken, refreshToken } = await generateTokens(user);

  // Fetch the user again without sensitive fields to send back to the client.
  const createdUser = await User.findById(user._id).select("-password -refreshToken");

  return res
    .status(201)
    .cookie("accessToken", accessToken, { ...cookieOptions, maxAge: 15 * 60 * 1000 })
    .cookie("refreshToken", refreshToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 })
    .json(
      new ApiResponse(
        201,
        { user: createdUser, accessToken, refreshToken },
        "User registered successfully"
      )
    );
});

// ========================================================================
// POST /api/v1/auth/login
// ========================================================================
export const loginUser = asyncHandler(async (req, res) => {
  const { email, username, password } = req.body;

  if (!password || (!email && !username)) {
    throw new ApiError(400, "Email/username and password are required");
  }

  // Allow login with either email OR username
  const user = await User.findOne({
    $or: [{ email: email?.toLowerCase() }, { username: username?.toLowerCase() }],
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  // isPasswordCorrect is an instance method defined in User.model.js
  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Incorrect password");
  }

  const { accessToken, refreshToken } = await generateTokens(user);

  const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

  return res
    .status(200)
    .cookie("accessToken", accessToken, { ...cookieOptions, maxAge: 15 * 60 * 1000 })
    .cookie("refreshToken", refreshToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 })
    .json(
      new ApiResponse(
        200,
        { user: loggedInUser, accessToken, refreshToken },
        "Login successful"
      )
    );
});

// ========================================================================
// POST /api/v1/auth/logout
// Requires verifyJWT middleware (so req.user is available)
// ========================================================================
export const logoutUser = asyncHandler(async (req, res) => {
  // Clear the refresh token in the database so it can no longer be used.
  await User.findByIdAndUpdate(req.user._id, { $unset: { refreshToken: 1 } });

  return res
    .status(200)
    .clearCookie("accessToken", cookieOptions)
    .clearCookie("refreshToken", cookieOptions)
    .json(new ApiResponse(200, {}, "Logged out successfully"));
});

// ========================================================================
// POST /api/v1/auth/refresh
// Uses the refreshToken cookie to issue a new accessToken.
// ========================================================================
export const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "Refresh token is missing");
  }

  // Verify the token's signature and expiry
  const decoded = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);

  const user = await User.findById(decoded._id);

  if (!user) {
    throw new ApiError(401, "Invalid refresh token - user not found");
  }

  // The token must match what we have stored in the DB. If it doesn't,
  // it means the token was already "used up" or the user logged out
  // elsewhere - treat this as a security issue and reject.
  if (incomingRefreshToken !== user.refreshToken) {
    throw new ApiError(401, "Refresh token is expired or has been used");
  }

  const { accessToken, refreshToken: newRefreshToken } = await generateTokens(user);

  return res
    .status(200)
    .cookie("accessToken", accessToken, { ...cookieOptions, maxAge: 15 * 60 * 1000 })
    .cookie("refreshToken", newRefreshToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 })
    .json(new ApiResponse(200, { accessToken, refreshToken: newRefreshToken }, "Token refreshed"));
});

// ========================================================================
// GET /api/v1/auth/me
// Returns the currently logged-in user's full profile.
// Requires verifyJWT middleware.
// ========================================================================
export const getCurrentUser = asyncHandler(async (req, res) => {
  return res.status(200).json(new ApiResponse(200, req.user, "Current user fetched"));
});
