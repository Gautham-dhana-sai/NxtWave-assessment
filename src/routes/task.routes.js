const { Router } = require('express');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const { task } = require('../validation/schemas');
const {
  createTask,
  listTasks,
  getTask,
  updateTask,
  updateTaskStatus,
  deleteTask,
} = require('../controllers/task.controller');

const router = Router();

// All task routes require a valid JWT
router.use(authenticate);

// RBAC per route:
//   GET  /          — all roles (MEMBER sees only their tasks — scoped in controller)
//   POST /          — ADMIN | MANAGER
//   GET  /:taskId   — all roles (MEMBER scoped in controller)
//   PATCH /:taskId  — ADMIN | MANAGER
//   PATCH /:taskId/status — all roles (assignee check done in controller)
//   DELETE /:taskId — ADMIN only

router.get('/', validate(task.listQuery, 'query'), listTasks);

router.post('/', authorize('ADMIN', 'MANAGER'), validate(task.create), createTask);

router.get('/:taskId', validate(task.params.taskId, 'params'), getTask);

router.patch(
  '/:taskId',
  authorize('ADMIN', 'MANAGER'),
  validate(task.params.taskId, 'params'),
  validate(task.update),
  updateTask
);

router.patch(
  '/:taskId/status',
  validate(task.params.taskId, 'params'),
  validate(task.updateStatus),
  updateTaskStatus
);

router.delete('/:taskId', authorize('ADMIN'), validate(task.params.taskId, 'params'), deleteTask);

module.exports = router;
