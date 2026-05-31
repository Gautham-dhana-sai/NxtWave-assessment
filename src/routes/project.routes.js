const { Router } = require('express');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const { project } = require('../validation/schemas');
const { createProject, listProjects, getProject, updateProject, deleteProject } = require('../controllers/project.controller');

const router = Router();

router.use(authenticate);

// RBAC per route:
//   GET  /            — ALL (MEMBER scoped to their projects in controller)
//   POST /            — ADMIN | MANAGER
//   GET  /:projectId  — ALL (MEMBER membership check in controller)
//   PATCH /:projectId — ADMIN | MANAGER
//   DELETE /:projectId — ADMIN only

router.get('/', listProjects);

router.post('/', authorize('ADMIN', 'MANAGER'), validate(project.create), createProject);

router.get('/:projectId', validate(project.params.projectId, 'params'), getProject);

router.patch(
  '/:projectId',
  authorize('ADMIN', 'MANAGER'),
  validate(project.params.projectId, 'params'),
  validate(project.update),
  updateProject
);

router.delete('/:projectId', authorize('ADMIN'), validate(project.params.projectId, 'params'), deleteProject);

module.exports = router;
