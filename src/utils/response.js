const sendError = (res, status, code, message) =>
  res.status(status).json({ status, code, message });

const sendSuccess = (res, status, data) =>
  res.status(status).json({ status, data });

module.exports = { sendError, sendSuccess };
