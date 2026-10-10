'use strict';

/**
 * Centralized error handler.
 * Never leaks stack traces, raw SQL errors, or credentials to the client.
 */
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  // Determine status code
  let status = err.statusCode || err.status || 500;
  let code = err.code || 'INTERNAL_ERROR';
  let message = err.message || 'An unexpected error occurred';
  let details = err.details || [];

  // Handle Zod validation errors
  if (err.name === 'ZodError' || err.issues) {
    status = 400;
    code = 'VALIDATION_ERROR';
    message = 'The request contains invalid data';
    const issues = err.issues || err.errors || [];
    details = issues.map((e) => ({
      field: e.path?.join('.') || '',
      message: e.message,
    }));
  }

  // Handle MySQL errors — never expose raw SQL or credentials
  if (err.sqlState !== undefined || err.code?.startsWith('ER_')) {
    const mysqlCode = err.code;
    status = 500;
    code = 'DATABASE_ERROR';
    message = 'A database error occurred';

    // Translate common MySQL errors to user-friendly messages
    if (mysqlCode === 'ER_DUP_ENTRY') {
      status = 409;
      code = 'DUPLICATE_ENTRY';
      message = extractDuplicateField(err.message);
    } else if (mysqlCode === 'ER_NO_REFERENCED_ROW_2') {
      status = 400;
      code = 'INVALID_REFERENCE';
      message = 'A referenced record does not exist';
    } else if (mysqlCode === 'ER_ROW_IS_REFERENCED_2') {
      status = 409;
      code = 'RECORD_IN_USE';
      message = 'This record cannot be deleted because it is referenced by other records';
    } else if (mysqlCode === 'ER_LOCK_WAIT_TIMEOUT' || mysqlCode === 'ER_LOCK_DEADLOCK') {
      status = 409;
      code = 'CONCURRENT_CONFLICT';
      message = 'The operation conflicted with another concurrent request. Please retry.';
    }
  }

  // Log the full error internally
  const logData = {
    requestId: req.id,
    method: req.method,
    path: req.path,
    status,
    code,
    error: process.env.NODE_ENV !== 'production' ? err.stack : err.message,
  };
  if (status >= 500) {
    console.error('[ERROR]', JSON.stringify(logData));
  } else {
    console.warn('[WARN]', JSON.stringify(logData));
  }

  res.status(status).json({
    success: false,
    error: {
      code,
      message,
      ...(details.length > 0 ? { details } : {}),
    },
    requestId: req.id,
  });
}

function extractDuplicateField(mysqlMessage) {
  // MySQL duplicate entry message: "Duplicate entry 'value' for key 'table.column'"
  const match = mysqlMessage.match(/for key '(.+?)'/);
  if (match) {
    const keyName = match[1];
    return `A record with this value already exists (constraint: ${keyName})`;
  }
  return 'A record with this value already exists';
}

module.exports = errorHandler;
