const Redis = require('ioredis');

let client;

const getRedis = () => {
  if (!client) {
    client = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });

    client.on('connect', () => console.log('Redis connected'));
    client.on('error', (err) => console.error('Redis error:', err.message));
  }
  return client;
};

module.exports = { getRedis };
