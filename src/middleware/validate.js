const { validationResult } = require('express-validator');
const { sendError } = require('../utils/response');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const first = errors.array()[0];
    return sendError(res, 400, 'VALIDATION_ERROR', first.msg);
  }
  next();
};

module.exports = validate;
