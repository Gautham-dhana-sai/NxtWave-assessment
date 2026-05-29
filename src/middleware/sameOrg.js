const { User } = require('../models/User');
const { sendError } = require('../utils/response');

/**
 * Ensures the target user (req.params.userId) belongs to the same
 * organization as the requester. Must run after authenticate.
 */
const sameOrg = async (req, res, next) => {
  const target = await User.findById(req.params.userId).select('organization');
  if (!target) return sendError(res, 404, 'NOT_FOUND', 'User not found');
  if (target.organization !== req.user.organization) {
    return sendError(res, 403, 'FORBIDDEN', 'Target user is not in your organization');
  }
  req.targetUser = target;
  next();
};

module.exports = sameOrg;
