// -----------------------------------------------------------------------
// multer.middleware.js
// Configures Multer (the file-upload library) to save uploaded files
// to specific folders on disk under /public/uploads/.
//
// Since we're NOT using Cloudinary or HLS transcoding (per project scope),
// uploaded videos/images are stored directly on the server's disk and
// served as static files (see app.js -> express.static("public")).
//
// IMPORTANT FOR DEPLOYMENT: Most free hosting platforms (like Render's
// free tier) have an EPHEMERAL filesystem - uploaded files may be wiped
// on restart/redeploy. For a portfolio demo this is usually fine, but if
// you need persistence, consider mounting a persistent disk or switching
// to a cloud storage provider later.
// -----------------------------------------------------------------------

import multer from "multer";
import path from "path";
import fs from "fs";

// Helper to build a storage engine for a specific subfolder
// (e.g. "videos", "shorts", "images", "avatars").
const createStorage = (subfolder) => {
  const uploadPath = path.join(process.cwd(), "public", "uploads", subfolder);

  // Make sure the folder exists before multer tries to save into it.
  if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
  }

  return multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      // Create a unique filename: <timestamp>-<random>-<original-name>
      // This prevents filename collisions if two users upload "video.mp4".
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const ext = path.extname(file.originalname);
      cb(null, `${uniqueSuffix}${ext}`);
    },
  });
};

// File filter to only allow video files (mp4, webm, mov) for video uploads
const videoFileFilter = (req, file, cb) => {
  const allowed = ["video/mp4", "video/webm", "video/quicktime"];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only MP4, WebM, and MOV video files are allowed"), false);
  }
};

// File filter to only allow common image formats
const imageFileFilter = (req, file, cb) => {
  const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only JPEG, PNG, WEBP, and GIF images are allowed"), false);
  }
};

// ---- Exported upload configs, one per use-case ----

// For long-form video uploads (Studio upload page)
// Accepts a "videoFile" field (the video) and a "thumbnail" field (image)
export const uploadVideo = multer({
  storage: createStorage("videos"),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB max
  fileFilter: (req, file, cb) => {
    if (file.fieldname === "videoFile") return videoFileFilter(req, file, cb);
    if (file.fieldname === "thumbnail") return imageFileFilter(req, file, cb);
    cb(new Error("Unexpected field"), false);
  },
}).fields([
  { name: "videoFile", maxCount: 1 },
  { name: "thumbnail", maxCount: 1 },
]);

// For Shorts uploads (vertical video, optional thumbnail)
export const uploadShort = multer({
  storage: createStorage("shorts"),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB max (shorts are <=60s)
  fileFilter: (req, file, cb) => {
    if (file.fieldname === "videoFile") return videoFileFilter(req, file, cb);
    if (file.fieldname === "thumbnail") return imageFileFilter(req, file, cb);
    cb(new Error("Unexpected field"), false);
  },
}).fields([
  { name: "videoFile", maxCount: 1 },
  { name: "thumbnail", maxCount: 1 },
]);

// For a single image (avatar, banner, post image)
export const uploadImage = multer({
  storage: createStorage("images"),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
  fileFilter: imageFileFilter,
});

// For avatars specifically (kept in its own folder for organisation)
export const uploadAvatar = multer({
  storage: createStorage("avatars"),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter: imageFileFilter,
});

// For up to 4 images on a community Post
export const uploadPostImages = multer({
  storage: createStorage("images"),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: imageFileFilter,
}).array("images", 4);
