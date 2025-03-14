const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');
const cors = require('cors');
const fs = require('fs');
const https = require('https');
const WebSocket = require("ws");
const { initWebSocketServer } = require('./websocket/server');
const jwt = require('jsonwebtoken');
const apiRouters = require('./routers/api/api');
const redisClient = require('../server/redisServer/redis');
const { connectMongoDB } = require('../server/mongodbServer/mongodb');
const { authenticate } = require('../server/utils/authenticate');
const responseMiddleware = require('../server/utils/responseMiddleware');


// 加载环境变量
dotenv.config({ path: `.env.${process.env.NODE_ENV || 'development'}` });
const app = express();

// 配置中间件
app.use(bodyParser.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
    origin: 'https://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(responseMiddleware);

// 跳过登录和注册的 JWT 验证
app.use((req, res, next) => {
    if (['/api/user/login', '/api/user/register', '/api/user/send-verification-code'].includes(req.path)) {
        return next();
    }
    authenticate(req, res, next);
});

// 请求记录中间件
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        const userId = req.userId ? `User ID: ${req.userId}` : 'User ID: Unauthenticated';
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms - ${userId}`);
    });
    next();
});

// 路由配置
app.use('/api', apiRouters);

// 加载 SSL 证书
const sslOptions = {
    key: fs.readFileSync('server.key'),
    cert: fs.readFileSync('server.crt')
};

// 创建 HTTPS 服务器
const server = https.createServer(sslOptions, app);
// 创建websocket
const WebSocketClient = new WebSocket.Server({ server });
console.log("WebSocket server started on port 8080");
// 配置 WebSocket
initWebSocketServer(WebSocketClient, redisClient)

// 启动 HTTPS 服务器
const port = process.env.PORT || 5000;
server.listen(port, async() => {
    console.log(`HTTPS Server is running on https://localhost:${port}`);

    // 检查 Redis 状态
    console.log('Redis 状态:', redisClient.status);

    // 检查 MongoDB 状态
    try {
        const mongoClient = await connectMongoDB();
        const admin = mongoClient.db().admin();
        const info = await admin.ping();
        console.log('MongoDB 状态:', info.ok === 1 ? 'Connected' : 'Disconnected');
    } catch (error) {
        console.error('MongoDB 连接状态检查失败:', error);
    }
});

module.exports = { app, authenticate };