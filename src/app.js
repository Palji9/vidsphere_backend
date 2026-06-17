// -----------------------------------------------------------------------
// app.js
// Creates and configures the Express application.
// Separated from server.js so the app can be imported for testing without
// actually starting the HTTP server.
// -----------------------------------------------------------------------

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import mongoSanitize from "express-mongo-sanitize";
import rateLimit from "express-rate-limit";
import morgan from "morgan";
import path from "path";
import { fileURLToPath } from "url";

import { errorHandler, notFound } from "./middleware/errorHandler.middleware.js";
import apiRouter from "./routes/index.js";

// __dirname doesn't exist in ES modules, so we reconstruct it:
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ── Security Middleware ─────────────────────────────────────────────────

// Helmet sets sensible HTTP security headers (Content-Security-Policy,
// X-Frame-Options, HSTS, etc.) automatically.
app.use(helmet({
  // We need to relax CSP a bit to allow video playback from our own server
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "media-src": ["'self'"],
    },
  },
}));

// CORS: only allow requests from our frontend origin (set in .env).
// credentials: true is required so cookies (the refresh token) are sent.
app.use(cors({
  origin: process.env.CORS_ORIGIN || "http://localhost:5173",
  credentials: true,
}));

// Sanitize MongoDB query injection attacks (e.g. { $gt: "" } in request body)
app.use(mongoSanitize());

// Global rate limit: 300 requests per 15 minutes per IP.
// Individual routes can have tighter limits applied separately.
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  standardHeaders: true,
  message: { success: false, message: "Too many requests, please try again later." },
}));

// ── Body Parsing ────────────────────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// ── Logging ─────────────────────────────────────────────────────────────
// Morgan logs HTTP requests: method, path, status, response time.
// "dev" format: colorized, concise output perfect for development.
if (process.env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

// ── Static Files ────────────────────────────────────────────────────────
// Serve everything in the /public folder as static files.
// This is how uploaded videos and images are accessible via URL:
//   POST /api/v1/videos -> multer saves to /public/uploads/videos/xyz.mp4
//   Frontend can play: <video src="http://localhost:5000/uploads/videos/xyz.mp4">
app.use(express.static(path.join(__dirname, "..", "public")));

// ── Health Check ─────────────────────────────────────────────────────────
// Simple endpoint for uptime monitors and deployment checks.
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// ── API Routes ────────────────────────────────────────────────────────────
app.use("/api/v1", apiRouter);

// ── Error Handling (MUST be last) ─────────────────────────────────────────
// notFound catches any request that didn't match a route above.
// errorHandler converts it to a clean JSON error response.
app.use(notFound);
app.use(errorHandler);

export default app;
