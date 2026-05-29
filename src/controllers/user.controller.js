const { User } = require('../models/User');
const { sendError, sendSuccess } = require('../utils/response');

// ADMIN: list all users in their organization
const listUsers = async (req, res) => {
  const users = await User.find({ organization: req.user.organization }).select('-refreshTokens');
  return sendSuccess(res, 200, { users });
};

// ADMIN: get a single user (same org enforced by sameOrg middleware)
const getUser = async (req, res) => {
  const user = await User.findById(req.params.userId).select('-refreshTokens');
  return sendSuccess(res, 200, { user });
};

// ADMIN: update a user's role
const updateUserRole = async (req, res) => {
  const { role } = req.body;

  if (req.params.userId === req.user._id.toString()) {
    return sendError(res, 400, 'BAD_REQUEST', 'You cannot change your own role');
  }

  const user = await User.findByIdAndUpdate(
    req.params.userId,
    { role },
    { returnDocument: 'after', runValidators: true }
  ).select('-refreshTokens');

  return sendSuccess(res, 200, { user });
};

// ADMIN: remove a user from the organization
const deleteUser = async (req, res) => {
  if (req.params.userId === req.user._id.toString()) {
    return sendError(res, 400, 'BAD_REQUEST', 'You cannot delete yourself');
  }

  await User.findByIdAndDelete(req.params.userId);
  return sendSuccess(res, 200, { message: 'User removed from organization' });
};

module.exports = { listUsers, getUser, updateUserRole, deleteUser };
