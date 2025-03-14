const jwt = require('jsonwebtoken');

// 引入 WebSocket 客户端对象（假设已导出）
const { clients } = require('../websocket/server');

const authenticate = (req, res, next) => {
    const token = req.cookies.jwtToken;

    if (!token) {
        return res.status(401).json({ message: '登录失效，请重新登录' });
    }

    try {
        // 验证 JWT
        const decoded = jwt.verify(token, process.env.SECURETY_KEY);

        // 将用户信息挂载到请求对象上
        req.userId = decoded.id;
        req.group = decoded.group;
        req.types = decoded.types;
        req.departments = decoded.departments;
        req.roleCodes = decoded.roleCodes;
        req.authoritieCodes = decoded.authoritieCodes;
        req.isLogin = decoded.isLogin;

        if (!req.isLogin) {
            // 如果用户未登录，清理 WebSocket 连接并返回登录失效
            if (clients[req.userId]) {
                clients[req.userId].close(); // 主动关闭 WebSocket 连接
                delete clients[req.userId];
                console.log(`WebSocket connection for user ${req.userId} has been closed.`);
            }
            return res.status(401).json({ message: '登录失效，请重新登录' });
        }

        // 会话有效，继续处理请求
        next();
    } catch (error) {
        // JWT 验证失败
        console.error('JWT 验证失败:', error.message);

        // 如果用户有 WebSocket 连接，清理连接
        if (req.userId && clients[req.userId]) {
            clients[req.userId].close();
            delete clients[req.userId];
            console.log(`WebSocket connection for user ${req.userId} has been closed due to invalid token.`);
        }

        return res.status(401).json({ message: '无效的JWT，请重新登录', error: error.message });
    }
};

module.exports = { authenticate };