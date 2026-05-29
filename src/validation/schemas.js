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

module.exports = { auth, user };
