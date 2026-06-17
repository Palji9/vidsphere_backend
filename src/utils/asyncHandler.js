// ─────────────────────────────────────────────────────────────────────────
// asyncHandler.js
// Express doesn't automatically catch errors thrown inside async functions.
// Without this wrapper, every controller would need its own try/catch block,
// which gets repetitive fast.
//
// Instead, we wrap every controller function with asyncHandler(). If the
// function throws an error (or rejects a promise), asyncHandler catches it
// and passes it to next(), which sends it to our global errorHandler
// middleware (see middleware/errorHandler.js).
//
// USAGE:
//   export const getVideo = asyncHandler(async (req, res) => {
//     const video = await Video.findById(req.params.id);
//     if (!video) throw new ApiError(404, "Video not found");
//     res.json(new ApiResponse(200, video));
//   });
// ─────────────────────────────────────────────────────────────────────────

const asyncHandler = (requestHandler) => {
  return (req, res, next) => {
    // Promise.resolve() ensures that even if requestHandler isn't async,
    // this still works correctly.
    Promise.resolve(requestHandler(req, res, next)).catch((err) => next(err));
  };
};

export default asyncHandler;
