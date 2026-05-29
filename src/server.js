require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');
const { getRedis } = require('./config/redis');

const PORT = process.env.PORT || 3000;

process.on('uncaughtException', (err) => {
  console.error(JSON.stringify({ ts: new Date().toISOString(), event: 'uncaughtException', error: err.message, stack: err.stack }));
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error(JSON.stringify({ ts: new Date().toISOString(), event: 'unhandledRejection', reason: String(reason) }));
  process.exit(1);
});

connectDB()
  .then(() => {
    getRedis().connect().catch(() => {
      // Redis connect errors are logged by the client — server still starts
    });

    const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

    // Graceful shutdown
    const shutdown = (signal) => {
      console.log(`${signal} received — shutting down`);
      server.close(() => process.exit(0));
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB:', err.message);
    process.exit(1);
  });
