// -----------------------------------------------------------------------
// errorHandler.middleware.js
// This is Express's "global error handler" - a special middleware with
// FOUR arguments (err, req, res, next). Express recognizes this signature
// and calls it whenever any route calls next(error) or throws inside an
// asyncHandler-wrapped function.
//
// This MUST be registered LAST in app.js, after all routes.
//
// It converts our custom ApiError (and any unexpected errors) into a
// consistent JSON response shape for the frontend.
// -----------------------------------------------------------------------

import { ApiError } from "../utils/apiResponse.js";

export const errorHandler = (err, req, res, next) => {
  let error = err;

  // If the error isn't already one of our ApiErrors (e.g. it's a raw
  // Mongoose validation error or an unexpected bug), convert it into one
  // with a generic 500 status so we don't leak internal details.
  if (!(error instanceof ApiError)) {
    const statusCode = error.statusCode || 500;
    const message = error.message || "Internal Server Error";
    error = new ApiError(statusCode, message, error?.errors || []);
  }

  const response = {
    success: false,
    statusCode: error.statusCode,
    message: error.message,
    errors: error.errors,
    // Only include the stack trace in development - never in production,
    // since it can reveal file paths and internal logic to attackers.
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  };

  // Log every error to the console so we can debug during development.
  console.error(`[ERROR] ${req.method} ${req.originalUrl} -> ${error.statusCode}: ${error.message}`);

  return res.status(error.statusCode).json(response);
};

// -----------------------------------------------------------------------
// notFound.middleware.js (combined here for convenience)
// Catches any request that doesn't match a defined route and forwards
// a clean 404 error to errorHandler above.
// -----------------------------------------------------------------------
export const notFound = (req, res, next) => {
  const error = new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`);
  next(error);
};
