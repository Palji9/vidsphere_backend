// ─────────────────────────────────────────────────────────────────────────
// pagination.js
// Small helper to turn query params like ?page=2&limit=20 into numbers
// we can safely use with Mongoose's .skip() and .limit().
// ─────────────────────────────────────────────────────────────────────────

/**
 * getPagination(req)
 * Reads `page` and `limit` from the request query string and returns
 * safe numeric values plus the computed `skip` value for MongoDB.
 *
 * Example: GET /api/v1/videos?page=2&limit=10
 *   -> { page: 2, limit: 10, skip: 10 }
 */
export const getPagination = (req) => {
  // Default to page 1, 20 items per page if not provided.
  let page = parseInt(req.query.page) || 1;
  let limit = parseInt(req.query.limit) || 20;

  // Guard against silly/negative values that could break queries.
  if (page < 1) page = 1;
  if (limit < 1) limit = 1;
  if (limit > 100) limit = 100; // Prevent someone requesting 1,000,000 docs at once

  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

/**
 * buildPaginatedResponse(docs, totalCount, page, limit)
 * Wraps a list of documents with pagination metadata, so the frontend
 * knows whether there's a "next page" button to show.
 */
export const buildPaginatedResponse = (docs, totalCount, page, limit) => {
  return {
    results: docs,
    pagination: {
      total: totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
      hasNextPage: page * limit < totalCount,
      hasPrevPage: page > 1,
    },
  };
};
