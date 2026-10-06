const config = require('./config');
let connection;

if (process.env.NODE_ENV === 'test') {
  const RedisMock = require('ioredis-mock');
  connection = new RedisMock({ maxRetriesPerRequest: null });
} else {
  const Redis = require('ioredis');
  if (process.env.REDIS_URL) {
    connection = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
  } else {
    connection = new Redis({
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: process.env.REDIS_PORT || 6379,
      maxRetriesPerRequest: null,
    });
  }
}

module.exports = { connection };
