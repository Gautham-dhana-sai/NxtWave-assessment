require('dotenv').config();
const express = require('express');
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 200, data: { message: 'API is running' } }));

// Route map — RBAC enforced at middleware level inside each router:
//   /api/auth/*          — public (register/login) + authenticated (me/logout/refresh)
//   /api/users/*         — ADMIN only
//   /api/projects/*      — ADMIN | MANAGER
//   /api/tasks/*         — ADMIN | MANAGER | MEMBER (scoped by role)
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ status: 404, code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` });
});

app.use(errorHandler);

module.exports = app;
