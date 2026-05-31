const { Task, TRANSITIONS } = require('../models/Task');
const { User } = require('../models/User');
const { Project } = require('../models/Project');
const { sendError, sendSuccess } = require('../utils/response');
const cache = require('../utils/cache');

// Verify assignee belongs to the same org
const resolveAssignee = async (assigneeId, org) => {
  if (!assigneeId) return null;
  const assignee = await User.findById(assigneeId).select('organization');
  if (!assignee || assignee.organization !== org) return false;
  return assigneeId;
};

// Verify project belongs to the same org
const resolveProject = async (projectId, org) => {
  if (!projectId) return null;
  const project = await Project.findById(projectId).select('organization');
  if (!project || project.organization !== org) return false;
  return projectId;
};

const populateTask = (task) =>
  task.populate([
    { path: 'assignee', select: 'name email role' },
    { path: 'createdBy', select: 'name email' },
    { path: 'project', select: 'name' },
  ]);

const createTask = async (req, res) => {
  const { title, description, priority, assignee, project, due_date } = req.body;

  if (assignee) {
    const valid = await resolveAssignee(assignee, req.user.organization);
    if (valid === false) return sendError(res, 400, 'VALIDATION_ERROR', 'Assignee does not belong to your organization');
  }

  if (project) {
    const valid = await resolveProject(project, req.user.organization);
    if (valid === false) return sendError(res, 400, 'VALIDATION_ERROR', 'Project does not belong to your organization');
  }

  const task = await Task.create({
    title,
    description,
    priority,
    assignee: assignee || null,
    project: project || null,
    due_date: due_date || null,
    organization: req.user.organization,
    createdBy: req.user._id,
  });

  await populateTask(task);

  // Invalidate org cache — new task affects list results for all roles
  await cache.invalidate(assignee || null, req.user.organization);

  return sendSuccess(res, 201, { task });
};

const listTasks = async (req, res) => {
  const { page, limit, status, priority, assignee } = req.query;

  const filter = { organization: req.user.organization };

  // MEMBER can only see their own tasks
  let cacheAssigneeId;
  if (req.user.role === 'MEMBER') {
    filter.assignee = req.user._id;
    cacheAssigneeId = String(req.user._id);
  } else {
    if (assignee) {
      filter.assignee = assignee;
      cacheAssigneeId = assignee;
    } else {
      // ADMIN/MANAGER listing all — key under a sentinel so it's still org-tracked
      cacheAssigneeId = `org:${req.user.organization}`;
    }
  }

  if (status) filter.status = status;
  if (priority) filter.priority = priority;

  const cacheKey = cache.buildKey(cacheAssigneeId, { page, limit, status, priority });
  const cached = await cache.get(cacheKey);
  if (cached) {
    res.set('X-Cache', 'HIT');
    return sendSuccess(res, 200, cached);
  }

  const skip = (page - 1) * limit;
  const [tasks, total] = await Promise.all([
    Task.find(filter)
      .populate('assignee', 'name email role')
      .populate('createdBy', 'name email')
      .populate('project', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Task.countDocuments(filter),
  ]);

  const payload = {
    tasks,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };

  await cache.set(cacheKey, payload, req.user.organization);

  res.set('X-Cache', 'MISS');
  return sendSuccess(res, 200, payload);
};

const getTask = async (req, res) => {
  const task = await Task.findOne({ _id: req.params.taskId, organization: req.user.organization })
    .populate('assignee', 'name email role')
    .populate('createdBy', 'name email')
    .populate('project', 'name');

  if (!task) return sendError(res, 404, 'NOT_FOUND', 'Task not found');

  // MEMBER can only view their assigned tasks
  if (req.user.role === 'MEMBER' && String(task.assignee?._id) !== String(req.user._id)) {
    return sendError(res, 403, 'FORBIDDEN', 'You can only view tasks assigned to you');
  }

  return sendSuccess(res, 200, { task });
};

const updateTask = async (req, res) => {
  const task = await Task.findOne({ _id: req.params.taskId, organization: req.user.organization });
  if (!task) return sendError(res, 404, 'NOT_FOUND', 'Task not found');

  const previousAssignee = task.assignee ? String(task.assignee) : null;
  const { assignee, project, ...rest } = req.body;

  if (assignee !== undefined) {
    if (assignee === null) {
      task.assignee = null;
    } else {
      const valid = await resolveAssignee(assignee, req.user.organization);
      if (valid === false) return sendError(res, 400, 'VALIDATION_ERROR', 'Assignee does not belong to your organization');
      task.assignee = assignee;
    }
  }

  if (project !== undefined) {
    if (project === null) {
      task.project = null;
    } else {
      const valid = await resolveProject(project, req.user.organization);
      if (valid === false) return sendError(res, 400, 'VALIDATION_ERROR', 'Project does not belong to your organization');
      task.project = project;
    }
  }

  Object.assign(task, rest);
  await task.save();

  await populateTask(task);

  // Invalidate both old and new assignee caches in case reassignment happened
  const newAssignee = task.assignee ? String(task.assignee._id) : null;
  await Promise.all([
    cache.invalidate(previousAssignee, req.user.organization),
    newAssignee !== previousAssignee ? cache.invalidate(newAssignee, req.user.organization) : Promise.resolve(),
  ]);

  return sendSuccess(res, 200, { task });
};

const updateTaskStatus = async (req, res) => {
  const { status: newStatus } = req.body;

  const task = await Task.findOne({ _id: req.params.taskId, organization: req.user.organization });
  if (!task) return sendError(res, 404, 'NOT_FOUND', 'Task not found');

  // Only the assignee or a MANAGER/ADMIN can advance status
  const isAssignee = String(task.assignee) === String(req.user._id);
  const isPrivileged = ['ADMIN', 'MANAGER'].includes(req.user.role);

  if (!isAssignee && !isPrivileged) {
    return sendError(res, 403, 'FORBIDDEN', 'Only the assignee or a Manager can update task status');
  }

  const allowed = TRANSITIONS[task.status];
  if (!allowed.includes(newStatus)) {
    return sendError(
      res,
      400,
      'INVALID_TRANSITION',
      `Cannot transition from ${task.status} to ${newStatus}. Allowed: ${allowed.join(', ') || 'none'}`
    );
  }

  task.status = newStatus;
  await task.save();

  await populateTask(task);

  await cache.invalidate(task.assignee ? String(task.assignee._id) : null, req.user.organization);

  return sendSuccess(res, 200, { task });
};

const deleteTask = async (req, res) => {
  const task = await Task.findOneAndDelete({ _id: req.params.taskId, organization: req.user.organization });
  if (!task) return sendError(res, 404, 'NOT_FOUND', 'Task not found');

  await cache.invalidate(task.assignee ? String(task.assignee) : null, req.user.organization);

  return sendSuccess(res, 200, { message: 'Task deleted successfully' });
};

module.exports = { createTask, listTasks, getTask, updateTask, updateTaskStatus, deleteTask };
