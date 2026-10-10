'use strict';

const { v4: uuidv4 } = require('uuid');

/**
 * Attach a unique X-Request-ID to every incoming request.
 * If the client sends one, we re-use it (useful for client-side correlation).
 */
function requestId(req, res, next) {
  const id = req.headers['x-request-id'] || uuidv4();
  req.id = id;
  res.setHeader('X-Request-ID', id);
  next();
}

module.exports = requestId;
