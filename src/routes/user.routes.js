const { Router } = require('express');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const sameOrg = require('../middleware/sameOrg');
const validate = require('../middleware/validate');
const { listUsers, getUser, updateUserRole, deleteUser } = require('../controllers/user.controller');
const { user } = require('../validation/schemas');

const router = Router();

router.use(authenticate, authorize('ADMIN'));

router.get('/', listUsers);

router.get(
  '/:userId',
  validate(user.params.userId, 'params'),
  sameOrg,
  getUser
);

router.patch(
  '/:userId/role',
  validate(user.params.userId, 'params'),
  validate(user.updateRole),
  sameOrg,
  updateUserRole
);

router.delete(
  '/:userId',
  validate(user.params.userId, 'params'),
  sameOrg,
  deleteUser
);

module.exports = router;
