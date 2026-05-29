const { Project } = require('../models/Project');
const { User } = require('../models/User');
const { sendError, sendSuccess } = require('../utils/response');

// Validate that all member IDs belong to the same org
const resolveMembers = async (memberIds, org) => {
  if (!memberIds || memberIds.length === 0) return [];
  const users = await User.find({ _id: { $in: memberIds }, organization: org }).select('_id');
  if (users.length !== memberIds.length) return false;
  return memberIds;
};

const createProject = async (req, res) => {
  const { name, description, members } = req.body;

  if (members.length) {
    const valid = await resolveMembers(members, req.user.organization);
    if (valid === false) return sendError(res, 400, 'VALIDATION_ERROR', 'One or more members do not belong to your organization');
  }

  const project = await Project.create({
    name,
    description,
    members,
    organization: req.user.organization,
    createdBy: req.user._id,
  });

  await project.populate([
    { path: 'members', select: 'name email role' },
    { path: 'createdBy', select: 'name email' },
  ]);

  return sendSuccess(res, 201, { project });
};

const listProjects = async (req, res) => {
  let filter = { organization: req.user.organization };

  // MEMBER can only see projects they are a member of
  if (req.user.role === 'MEMBER') {
    filter.members = req.user._id;
  }

  const projects = await Project.find(filter)
    .populate('members', 'name email role')
    .populate('createdBy', 'name email')
    .sort({ createdAt: -1 });

  return sendSuccess(res, 200, { projects });
};

const getProject = async (req, res) => {
  const project = await Project.findOne({ _id: req.params.projectId, organization: req.user.organization })
    .populate('members', 'name email role')
    .populate('createdBy', 'name email');

  if (!project) return sendError(res, 404, 'NOT_FOUND', 'Project not found');

  if (req.user.role === 'MEMBER' && !project.members.some(m => String(m._id) === String(req.user._id))) {
    return sendError(res, 403, 'FORBIDDEN', 'You are not a member of this project');
  }

  return sendSuccess(res, 200, { project });
};

const updateProject = async (req, res) => {
  const project = await Project.findOne({ _id: req.params.projectId, organization: req.user.organization });
  if (!project) return sendError(res, 404, 'NOT_FOUND', 'Project not found');

  const { members, ...rest } = req.body;

  if (members !== undefined) {
    const valid = await resolveMembers(members, req.user.organization);
    if (valid === false) return sendError(res, 400, 'VALIDATION_ERROR', 'One or more members do not belong to your organization');
    project.members = members;
  }

  Object.assign(project, rest);
  await project.save();

  await project.populate([
    { path: 'members', select: 'name email role' },
    { path: 'createdBy', select: 'name email' },
  ]);

  return sendSuccess(res, 200, { project });
};

const deleteProject = async (req, res) => {
  const project = await Project.findOneAndDelete({ _id: req.params.projectId, organization: req.user.organization });
  if (!project) return sendError(res, 404, 'NOT_FOUND', 'Project not found');
  return sendSuccess(res, 200, { message: 'Project deleted successfully' });
};

module.exports = { createProject, listProjects, getProject, updateProject, deleteProject };
