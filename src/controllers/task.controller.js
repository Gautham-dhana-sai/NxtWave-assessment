const { Task, TRANSITIONS } = require('../models/Task');
const { User } = require('../models/User');
const { sendError, sendSuccess } = require('../utils/response');

// Verify assignee belongs to the same org
const resolveAssignee = async (assigneeId, org) => {
  if (!assigneeId) return null;
  const assignee = await User.findById(assigneeId).select('organization');
  if (!assignee || assignee.organization !== org) return false;
  return assigneeId;
};

const createTask = async (req, res) => {
  const { title, description, priority, assignee, due_date } = req.body;

  if (assignee) {
    const valid = await resolveAssignee(assignee, req.user.organization);
    if (valid === false) return sendError(res, 400, 'VALIDATION_ERROR', 'Assignee does not belong to your organization');
  }

  const task = await Task.create({
    title,
    description,
    priority,
    assignee: assignee || null,
    due_date: due_date || null,
    organization: req.user.organization,
    createdBy: req.user._id,
  });

  await task.populate([
    { path: 'assignee', select: 'name email role' },
    { path: 'createdBy', select: 'name email' },
  ]);

  return sendSuccess(res, 201, { task });
};

const listTasks = async (req, res) => {
  const { page, limit, status, priority, assignee } = req.query;

  const filter = { organization: req.user.organization };

  // MEMBER can only see their own tasks
  if (req.user.role === 'MEMBER') {
    filter.assignee = req.user._id;
  } else {
    if (assignee) filter.assignee = assignee;
  }

  if (status) filter.status = status;
  if (priority) filter.priority = priority;

  const skip = (page - 1) * limit;
  const [tasks, total] = await Promise.all([
    Task.find(filter)
      .populate('assignee', 'name email role')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Task.countDocuments(filter),
  ]);

  return sendSuccess(res, 200, {
    tasks,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
};

const getTask = async (req, res) => {
  const task = await Task.findOne({ _id: req.params.taskId, organization: req.user.organization })
    .populate('assignee', 'name email role')
    .populate('createdBy', 'name email');

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

  // MEMBER cannot update task fields (only status via PATCH /status)
  if (req.user.role === 'MEMBER') {
    return sendError(res, 403, 'FORBIDDEN', 'Members can only update task status');
  }

  const { assignee, ...rest } = req.body;

  if (assignee !== undefined) {
    if (assignee === null) {
      task.assignee = null;
    } else {
      const valid = await resolveAssignee(assignee, req.user.organization);
      if (valid === false) return sendError(res, 400, 'VALIDATION_ERROR', 'Assignee does not belong to your organization');
      task.assignee = assignee;
    }
  }

  Object.assign(task, rest);
  await task.save();

  await task.populate([
    { path: 'assignee', select: 'name email role' },
    { path: 'createdBy', select: 'name email' },
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

  await task.populate([
    { path: 'assignee', select: 'name email role' },
    { path: 'createdBy', select: 'name email' },
  ]);

  return sendSuccess(res, 200, { task });
};

const deleteTask = async (req, res) => {
  const task = await Task.findOneAndDelete({ _id: req.params.taskId, organization: req.user.organization });
  if (!task) return sendError(res, 404, 'NOT_FOUND', 'Task not found');
  return sendSuccess(res, 200, { message: 'Task deleted successfully' });
};

module.exports = { createTask, listTasks, getTask, updateTask, updateTaskStatus, deleteTask };
