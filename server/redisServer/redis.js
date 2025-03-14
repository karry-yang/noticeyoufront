// redis.js
const Redis = require('ioredis');
const dotenv = require('dotenv');

dotenv.config({ path: `.env.${process.env.NODE_ENV || 'development'}` });

const redisClient = new Redis({
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
});

(async() => {
    try {
        console.log('Connecting to Redis...');
        // await redisClient.connect(); // 确保连接完成
        console.log('Redis client connected and ready');
    } catch (error) {
        console.error('Error connecting to Redis:', error);
    }
})();

// Redis 事件监听
redisClient.on('connect', () => {
    console.log('Redis client connected');
});

redisClient.on('ready', () => {
    console.log('Redis client is ready');
});

redisClient.on('end', () => {
    console.log('Redis client disconnected');
});

redisClient.on('error', (err) => {
    console.error('Redis client error:', err);
});

// 处理优雅关闭
process.on('SIGINT', async() => {
    try {
        await redisClient.quit();
        console.log('Redis connection closed');
        process.exit(0);
    } catch (err) {
        console.error('Error closing Redis connection:', err);
        process.exit(1);
    }
});

module.exports = redisClient;