const { Router } = require('express');
const { register, login, refreshToken, logout, getMe } = require('../controllers/auth.controller');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const { auth } = require('../validation/schemas');

const router = Router();

router.post('/register', validate(auth.register), register);
router.post('/login', validate(auth.login), login);
router.post('/refresh-token', validate(auth.refreshToken), refreshToken);
router.post('/logout', authenticate, validate(auth.logout), logout);
router.get('/me', authenticate, getMe);

module.exports = router;
