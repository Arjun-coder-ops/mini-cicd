const config = require('./config');
let connection;

if (process.env.NODE_ENV === 'test') {
  const RedisMock = require('ioredis-mock');
  connection = new RedisMock({ maxRetriesPerRequest: null });
} else {
  const Redis = require('ioredis');
  let redisUrl = process.env.REDIS_URL ? process.env.REDIS_URL.trim() : '';
  if (redisUrl) {
    // Sanitize in case CLI command was accidentally pasted (e.g. 'redis-cli -u redis://...')
    const match = redisUrl.match(/redis[s]?:\/\/[^\s'"]+$/i);
    if (match) redisUrl = match[0];
    connection = new Redis(redisUrl, { maxRetriesPerRequest: null });
  } else {
    connection = new Redis({
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: process.env.REDIS_PORT || 6379,
      maxRetriesPerRequest: null,
    });
  }
}

module.exports = { connection };
