'use strict';

/**
 * Shared response helpers to keep API responses consistent.
 */

function success(res, data, statusCode = 200) {
  res.status(statusCode).json({
    success: true,
    data,
  });
}

function created(res, data) {
  success(res, data, 201);
}

function paginated(res, { data, total, page, pageSize }) {
  res.status(200).json({
    success: true,
    data,
    pagination: {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  });
}

function noContent(res) {
  res.status(204).end();
}

/**
 * Parse and validate standard pagination query params.
 * Returns { page, pageSize, offset }.
 */
function parsePagination(query, maxPageSize = 200) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const pageSize = Math.min(
    maxPageSize,
    Math.max(1, parseInt(query.pageSize || query.page_size, 10) || 20)
  );
  const offset = (page - 1) * pageSize;
  return { page, pageSize, offset };
}

/**
 * Create an AppError with a status code and optional error code.
 */
function createError(message, statusCode = 400, code = 'BAD_REQUEST') {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  return err;
}

module.exports = { success, created, paginated, noContent, parsePagination, createError };
