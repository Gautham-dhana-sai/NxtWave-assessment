const { verifyAccessToken } = require('../utils/jwt');
const { User } = require('../models/User');
const { sendError } = require('../utils/response');

const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendError(res, 401, 'UNAUTHORIZED', 'Access token required');
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = verifyAccessToken(token);
    const user = await User.findById(decoded.userId).select('-refreshTokens');
    if (!user) return sendError(res, 401, 'UNAUTHORIZED', 'User no longer exists');
    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return sendError(res, 401, 'TOKEN_EXPIRED', 'Access token has expired');
    }
    return sendError(res, 401, 'INVALID_TOKEN', 'Invalid access token');
  }
};

module.exports = authenticate;
