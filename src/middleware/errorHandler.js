const { sendError } = require('../utils/response');

const errorHandler = (err, req, res, next) => {
  // Structured error log — never expose stack to client
  console.error(JSON.stringify({
    ts: new Date().toISOString(),
    method: req.method,
    path: req.path,
    error: err.name,
    message: err.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  }));

  // Malformed JSON body (thrown by body-parser before reaching any route)
  if (err.type === 'entity.parse.failed') {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Request body contains invalid JSON');
  }

  // Payload too large
  if (err.type === 'entity.too.large') {
    return sendError(res, 413, 'PAYLOAD_TOO_LARGE', 'Request body exceeds the allowed size limit');
  }

  // Mongoose validation failure (schema-level, e.g. enum, required)
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map((e) => e.message).join(', ');
    return sendError(res, 400, 'VALIDATION_ERROR', message);
  }

  // Mongoose invalid ObjectId (CastError — e.g. a bad ref that slips past Joi)
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    return sendError(res, 400, 'VALIDATION_ERROR', `Invalid ID format for field '${err.path}'`);
  }

  // MongoDB duplicate key
  if (err.code === 11000 && err.keyValue) {
    const field = Object.keys(err.keyValue)[0];
    return sendError(res, 409, 'CONFLICT', `${field} already exists`);
  }

  // JWT errors that bubble up outside authenticate middleware
  if (err.name === 'JsonWebTokenError') {
    return sendError(res, 401, 'INVALID_TOKEN', 'Invalid token');
  }
  if (err.name === 'TokenExpiredError') {
    return sendError(res, 401, 'TOKEN_EXPIRED', 'Token has expired');
  }

  // Operational errors created with a known status (e.g. throw Object.assign(new Error(...), { status: 403 }))
  if (err.status && err.status < 500) {
    return sendError(res, err.status, err.code || 'REQUEST_ERROR', err.message);
  }

  // Unhandled — never leak internals
  return sendError(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
};

module.exports = errorHandler;
