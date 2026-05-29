const errorHandler = (err, req, res, next) => {
  console.error(err);

  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map((e) => e.message).join(', ');
    return res.status(400).json({ status: 400, code: 'VALIDATION_ERROR', message });
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(409).json({ status: 409, code: 'CONFLICT', message: `${field} already exists` });
  }

  const status = err.status || 500;
  return res.status(status).json({
    status,
    code: err.code || 'INTERNAL_ERROR',
    message: err.message || 'An unexpected error occurred',
  });
};

module.exports = errorHandler;
