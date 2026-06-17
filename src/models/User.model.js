// ─────────────────────────────────────────────────────────────────────────
// User.model.js
//
// DESIGN NOTE: In the original PRD, "User" and "Channel" were two separate
// collections. To keep this codebase simpler and easier to learn from,
// we've MERGED them: every User IS their own Channel.
//
//   - user.username   -> channel handle  (e.g. "@johndoe")
//   - user.fullName   -> channel display name
//   - user.avatar     -> profile picture AND channel icon
//   - user.coverImage -> channel banner
//
// Subscriber counts are NOT stored directly on this document (that would
// get out of sync). Instead, they're calculated by counting documents in
// the Subscription collection — see subscription.controller.js.
// ─────────────────────────────────────────────────────────────────────────

import mongoose, { Schema } from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const userSchema = new Schema(
  {
    // Unique handle used in URLs, e.g. /channel/johndoe
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true, // Index = faster lookups when searching by username
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    // Profile picture / channel icon — stores a relative URL like
    // "/uploads/avatars/abc123.jpg" since we're using local disk storage.
    avatar: {
      type: String,
      default: "",
    },
    // Channel banner image shown at top of channel page.
    coverImage: {
      type: String,
      default: "",
    },
    bio: {
      type: String,
      default: "",
      maxlength: 500,
    },
    // Hashed password — NEVER store plain text passwords!
    password: {
      type: String,
      required: true,
    },
    // RBAC (Role-Based Access Control). Determines what a user can do:
    //   user     -> normal viewer/commenter
    //   creator  -> can upload videos/shorts, access Studio
    //   moderator-> can moderate content within communities
    //   admin    -> full access to /admin panel
    role: {
      type: String,
      enum: ["user", "creator", "moderator", "admin"],
      default: "user",
    },
    // Stores the latest refresh token so we can invalidate sessions
    // (e.g. on logout) by clearing this field.
    refreshToken: {
      type: String,
    },
    // List of video IDs the user has watched, most recent first.
    // Used for the "Watch History" page.
    watchHistory: [
      {
        type: Schema.Types.ObjectId,
        ref: "Video",
      },
    ],
    isVerified: {
      type: Boolean,
      default: false, // Set true after email verification
    },
  },
  {
    // Automatically adds createdAt and updatedAt fields
    timestamps: true,
  }
);

// ───────────────────────────────────────────────────────────────────────
// MONGOOSE MIDDLEWARE (hooks) — runs automatically before/after save, etc.
// ───────────────────────────────────────────────────────────────────────

// Before saving a user document, if the password field was changed,
// hash it with bcrypt. This ensures we NEVER store plain-text passwords.
userSchema.pre("save", async function (next) {
  // `this` refers to the document being saved.
  if (!this.isModified("password")) return next(); // Skip if password unchanged

  // 10 = "salt rounds" — higher = more secure but slower. 10 is a good default.
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// ───────────────────────────────────────────────────────────────────────
// INSTANCE METHODS — available on any user document, e.g. user.isPasswordCorrect()
// ───────────────────────────────────────────────────────────────────────

// Compares a plain-text password (from login form) against the hashed
// password stored in the database.
userSchema.methods.isPasswordCorrect = async function (plainPassword) {
  return await bcrypt.compare(plainPassword, this.password);
};

// Generates a short-lived JWT access token (used for API authorization).
// Sent to the client and stored in memory / Authorization header.
userSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    {
      _id: this._id,
      email: this.email,
      username: this.username,
      role: this.role,
    },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRY }
  );
};

// Generates a long-lived JWT refresh token (used to get new access tokens
// without re-entering a password). Stored in an httpOnly cookie.
userSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    { _id: this._id },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRY }
  );
};

export const User = mongoose.model("User", userSchema);
