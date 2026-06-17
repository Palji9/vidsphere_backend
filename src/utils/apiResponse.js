// ─────────────────────────────────────────────────────────────────────────
// apiResponse.js
// Standardised response shapes so every endpoint returns JSON in the same
// format. This makes the frontend's job much easier — it always knows
// where to look for data, success flag, and error messages.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Use this for ALL successful responses.
 * Example: return res.status(200).json(new ApiResponse(200, user, "Login successful"));
 *
 * Resulting JSON:
 * {
 *   "success": true,
 *   "statusCode": 200,
 *   "message": "Login successful",
 *   "data": { ...user }
 * }
 */
class ApiResponse {
  constructor(statusCode, data, message = "Success") {
    this.statusCode = statusCode;
    this.data = data;
    this.message = message;
    // Any status code under 400 is considered a "success" in HTTP.
    this.success = statusCode < 400;
  }
}

/**
 * Custom Error class for known/expected errors (e.g. "Video not found").
 * We throw this inside controllers, and our global errorHandler middleware
 * catches it and sends a clean JSON error response instead of crashing.
 *
 * Example: throw new ApiError(404, "Video not found");
 */
class ApiError extends Error {
  constructor(statusCode, message = "Something went wrong", errors = []) {
    super(message); // Call the built-in Error constructor with our message
    this.statusCode = statusCode;
    this.errors = errors; // Optional: array of field-specific validation errors
    this.success = false;
    this.data = null;
  }
}

export { ApiResponse, ApiError };
