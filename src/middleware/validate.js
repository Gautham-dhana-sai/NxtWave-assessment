const { sendError } = require('../utils/response');

/**
 * validate(schema, source?) — source is 'body' | 'params' | 'query', defaults to 'body'.
 * Returns an Express middleware that validates req[source] against the Joi schema.
 */
const validate = (schema, source = 'body') => (req, res, next) => {
  const { error, value } = schema.validate(req[source], { abortEarly: true, stripUnknown: true });
  if (error) {
    return sendError(res, 400, 'VALIDATION_ERROR', error.details[0].message);
  }
  req[source] = value;
  next();
};

module.exports = validate;
