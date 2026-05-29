require('dotenv').config();
const express = require('express');
const morgan = require('morgan');
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const taskRoutes = require('./routes/task.routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// HTTP request logging — skip in test env
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('[:date[iso]] :method :url :status :res[content-length] - :response-time ms'));
}

// Body parsing with size guard (10kb is generous for this API's payloads)
app.use(express.json({ limit: '10kb' }));

app.get('/health', (req, res) => res.json({ status: 200, data: { message: 'API is running' } }));

// Route map — RBAC enforced at middleware level inside each router:
//   /api/auth/*          — public (register/login) + authenticated (me/logout/refresh)
//   /api/users/*         — ADMIN only
//   /api/projects/*      — ADMIN | MANAGER
//   /api/tasks/*         — ADMIN | MANAGER | MEMBER (scoped by role)
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tasks', taskRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ status: 404, code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` });
});

app.use(errorHandler);

module.exports = app;
