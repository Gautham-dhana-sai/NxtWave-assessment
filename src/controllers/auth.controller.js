const { User } = require('../models/User');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../utils/jwt');
const { sendError, sendSuccess } = require('../utils/response');

const tokenPayload = (user) => ({ userId: user._id, role: user.role, org: user.organization });

const register = async (req, res) => {
  const { name, email, password, role, organization } = req.body;

  const existing = await User.findOne({ email });
  if (existing) return sendError(res, 409, 'CONFLICT', 'Email already registered');

  const user = await User.create({ name, email, password, role, organization });

  const accessToken = signAccessToken(tokenPayload(user));
  const refreshToken = signRefreshToken(tokenPayload(user));

  await User.findByIdAndUpdate(user._id, { $push: { refreshTokens: refreshToken } });

  return sendSuccess(res, 201, {
    user: { id: user._id, name: user.name, email: user.email, role: user.role, organization: user.organization },
    accessToken,
    refreshToken,
  });
};

const login = async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+password +refreshTokens');
  if (!user || !(await user.comparePassword(password))) {
    return sendError(res, 401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  const accessToken = signAccessToken(tokenPayload(user));
  const refreshToken = signRefreshToken(tokenPayload(user));

  user.refreshTokens.push(refreshToken);
  await user.save();

  return sendSuccess(res, 200, {
    user: { id: user._id, name: user.name, email: user.email, role: user.role, organization: user.organization },
    accessToken,
    refreshToken,
  });
};

const refreshToken = async (req, res) => {
  const { refreshToken: token } = req.body;
  if (!token) return sendError(res, 400, 'VALIDATION_ERROR', 'Refresh token required');

  let decoded;
  try {
    decoded = verifyRefreshToken(token);
  } catch {
    return sendError(res, 401, 'INVALID_TOKEN', 'Invalid or expired refresh token');
  }

  const user = await User.findById(decoded.userId).select('+refreshTokens');
  if (!user || !user.refreshTokens.includes(token)) {
    // Token reuse detected — invalidate all tokens (rotation security)
    if (user) {
      user.refreshTokens = [];
      await user.save();
    }
    return sendError(res, 401, 'INVALID_TOKEN', 'Refresh token reuse detected. Please log in again.');
  }

  // Rotate: remove old token, issue new pair
  user.refreshTokens = user.refreshTokens.filter((t) => t !== token);
  const newAccessToken = signAccessToken(tokenPayload(user));
  const newRefreshToken = signRefreshToken(tokenPayload(user));
  user.refreshTokens.push(newRefreshToken);
  await user.save();

  return sendSuccess(res, 200, { accessToken: newAccessToken, refreshToken: newRefreshToken });
};

const logout = async (req, res) => {
  const { refreshToken: token } = req.body;
  if (!token) return sendError(res, 400, 'VALIDATION_ERROR', 'Refresh token required');

  const user = await User.findById(req.user._id).select('+refreshTokens');
  if (user) {
    user.refreshTokens = user.refreshTokens.filter((t) => t !== token);
    await user.save();
  }

  return sendSuccess(res, 200, { message: 'Logged out successfully' });
};

const getMe = (req, res) => {
  const { _id, name, email, role, organization, createdAt } = req.user;
  return sendSuccess(res, 200, { user: { id: _id, name, email, role, organization, createdAt } });
};

module.exports = { register, login, refreshToken, logout, getMe };
