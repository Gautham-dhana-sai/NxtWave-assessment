const Joi = require('joi');

const mongoId = Joi.string()
  .pattern(/^[a-f\d]{24}$/i)
  .message('must be a valid MongoDB ObjectId');

const auth = {
  register: Joi.object({
    name: Joi.string().trim().min(1).required().messages({
      'string.empty': 'Name is required',
      'any.required': 'Name is required',
    }),
    email: Joi.string().email().lowercase().required().messages({
      'string.email': 'Valid email is required',
      'any.required': 'Email is required',
    }),
    password: Joi.string().min(6).required().messages({
      'string.min': 'Password must be at least 6 characters',
      'any.required': 'Password is required',
    }),
    organization: Joi.string().trim().min(1).required().messages({
      'string.empty': 'Organization is required',
      'any.required': 'Organization is required',
    }),
    role: Joi.string().valid('ADMIN', 'MANAGER', 'MEMBER').default('MEMBER').messages({
      'any.only': 'Role must be ADMIN, MANAGER, or MEMBER',
    }),
  }),

  login: Joi.object({
    email: Joi.string().email().lowercase().required().messages({
      'string.email': 'Valid email is required',
      'any.required': 'Email is required',
    }),
    password: Joi.string().required().messages({
      'any.required': 'Password is required',
    }),
  }),

  refreshToken: Joi.object({
    refreshToken: Joi.string().required().messages({
      'any.required': 'Refresh token is required',
    }),
  }),

  logout: Joi.object({
    refreshToken: Joi.string().required().messages({
      'any.required': 'Refresh token is required',
    }),
  }),
};

const user = {
  updateRole: Joi.object({
    role: Joi.string().valid('ADMIN', 'MANAGER', 'MEMBER').required().messages({
      'any.only': 'Role must be ADMIN, MANAGER, or MEMBER',
      'any.required': 'Role is required',
    }),
  }),

  params: {
    userId: Joi.object({
      userId: mongoId.required().messages({
        'any.required': 'User ID is required',
      }),
    }),
  },
};

const task = {
  create: Joi.object({
    title: Joi.string().trim().min(1).required().messages({
      'string.empty': 'Title is required',
      'any.required': 'Title is required',
    }),
    description: Joi.string().trim().allow('').default(''),
    priority: Joi.string().valid('LOW', 'MEDIUM', 'HIGH').default('MEDIUM').messages({
      'any.only': 'Priority must be LOW, MEDIUM, or HIGH',
    }),
    assignee: mongoId.allow(null).default(null).messages({
      'string.pattern.base': 'assignee must be a valid MongoDB ObjectId',
    }),
    due_date: Joi.date().iso().greater('now').allow(null).default(null).messages({
      'date.greater': 'due_date must be a future date',
      'date.iso': 'due_date must be a valid ISO date',
    }),
  }),

  update: Joi.object({
    title: Joi.string().trim().min(1).messages({
      'string.empty': 'Title cannot be empty',
    }),
    description: Joi.string().trim().allow(''),
    priority: Joi.string().valid('LOW', 'MEDIUM', 'HIGH').messages({
      'any.only': 'Priority must be LOW, MEDIUM, or HIGH',
    }),
    assignee: mongoId.allow(null).messages({
      'string.pattern.base': 'assignee must be a valid MongoDB ObjectId',
    }),
    due_date: Joi.date().iso().greater('now').allow(null).messages({
      'date.greater': 'due_date must be a future date',
      'date.iso': 'due_date must be a valid ISO date',
    }),
  }).min(1).messages({
    'object.min': 'At least one field must be provided to update',
  }),

  updateStatus: Joi.object({
    status: Joi.string().valid('TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'BLOCKED').required().messages({
      'any.only': 'Status must be TODO, IN_PROGRESS, IN_REVIEW, DONE, or BLOCKED',
      'any.required': 'Status is required',
    }),
  }),

  listQuery: Joi.object({
    page: Joi.number().integer().min(1).default(1).messages({
      'number.min': 'page must be at least 1',
    }),
    limit: Joi.number().integer().min(1).max(100).default(20).messages({
      'number.min': 'limit must be at least 1',
      'number.max': 'limit cannot exceed 100',
    }),
    status: Joi.string().valid('TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'BLOCKED').messages({
      'any.only': 'status filter must be TODO, IN_PROGRESS, IN_REVIEW, DONE, or BLOCKED',
    }),
    priority: Joi.string().valid('LOW', 'MEDIUM', 'HIGH').messages({
      'any.only': 'priority filter must be LOW, MEDIUM, or HIGH',
    }),
    assignee: mongoId.messages({
      'string.pattern.base': 'assignee filter must be a valid MongoDB ObjectId',
    }),
  }),

  params: {
    taskId: Joi.object({
      taskId: mongoId.required().messages({
        'any.required': 'Task ID is required',
        'string.pattern.base': 'taskId must be a valid MongoDB ObjectId',
      }),
    }),
  },
};

module.exports = { auth, user, task };
