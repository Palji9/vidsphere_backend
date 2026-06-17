# VidSphere Backend

YouTube Clone + Social Media Platform — Node.js/Express/MongoDB REST API + Socket.io

## 🚀 Quick Start

```bash
# 1. Clone the repo
git clone <your-repo-url>
cd vidsphere-backend

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env and fill in your MongoDB Atlas URI, JWT secrets, etc.

# 4. Start dev server (auto-restarts on file changes)
npm run dev
```

Server runs at `http://localhost:5000`

## 📁 Folder Structure

```
src/
├── config/         # DB + env config
├── controllers/    # Request handlers (one per feature)
├── middleware/     # Auth (JWT), RBAC, file upload (Multer), error handler
├── models/         # Mongoose schemas (User, Video, Short, Post, ...)
├── routes/         # Express route definitions
├── socket/         # Socket.io setup + event handlers
└── utils/          # ApiResponse, asyncHandler, pagination helpers

public/
└── uploads/        # Uploaded files served as static assets
    ├── videos/
    ├── shorts/
    ├── images/
    └── avatars/
```

## 🔑 Key Design Decisions

- **User = Channel**: Every user IS their own channel (no separate Channel model)
- **Polymorphic Comments/Likes**: One collection each, used for Videos + Shorts + Posts
- **No FFmpeg/HLS**: Videos stored as-is, played with HTML `<video>` tag
- **Simplified Live**: Browser camera relay over Socket.io (no RTMP server needed)
- **JWT + httpOnly Cookie**: Access token (15min) in body + Refresh token (7d) in cookie

## 📡 API Base URL

`http://localhost:5000/api/v1`

## 🧩 Models

| Model | Purpose |
|-------|---------|
| User | Users + Channels (merged) |
| Video | Long-form videos |
| Short | Vertical short clips |
| Post | Community/social posts |
| Comment | Comments on Videos/Shorts/Posts |
| Like | Likes on Videos/Shorts/Posts/Comments |
| Subscription | Channel follow relationship |
| Playlist | Ordered video collections |
| Conversation | DM threads |
| Message | Individual DM messages |
| Notification | User notification items |
| LiveStream | Live stream metadata |
| Report | Content reports |
| AuditLog | Admin action history |

## 🔐 Auth Flow

1. `POST /api/v1/auth/register` → returns user + access token + sets refresh cookie
2. `POST /api/v1/auth/login` → same response
3. Every protected request → `Authorization: Bearer <accessToken>` header
4. When access token expires → `POST /api/v1/auth/refresh` (cookie sent automatically)
5. `POST /api/v1/auth/logout` → clears refresh token from DB + cookie
# vidsphere_backend
