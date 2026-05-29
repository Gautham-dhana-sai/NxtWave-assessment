const { sendError } = require('../utils/response');

/**
 * authorize(...roles) — pass allowed role strings.
 * RBAC is enforced here at the middleware level, not in controllers.
 */
const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return sendError(res, 403, 'FORBIDDEN', 'You do not have permission to perform this action');
  }
  next();
};

module.exports = authorize;
