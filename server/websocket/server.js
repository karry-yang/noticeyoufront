const jwt = require("jsonwebtoken");
const { createKafkaConsumer, destroyKafkaConsumer } = require("../kafkaServer/consumer");



// 保存 WebSocket 连接的用户集合
let clients = {};

function initWebSocketServer(WebSocketClient, redisClient) {
    // WebSocket 连接管理

    WebSocketClient.on("connection", (ws, req) => {
        // 获取 cookie 并解析 JWT（这里直接从 header 中读取 Cookie）
        const cookies = req.headers.cookie;
        console.log("websocket连接成功")
        if (!cookies) {
            console.log("No cookies found, closing connection.");
            ws.close();
            return;
        }

        // 解析 cookies，获取 JWT
        const jwtToken = parseCookie(cookies).jwtToken; // 假设 token 在 cookie 中叫做 'token'
        if (!jwtToken) {
            console.log("No JWT found in cookies, closing connection.");
            ws.close();
            return;
        }

        let decoded;
        try {
            // 验证 JWT 并解析出 userId 和 orgId
            decoded = jwt.verify(jwtToken, "notice_you"); // 替换为实际的 JWT 密钥
        } catch (err) {
            console.log("Invalid JWT:", err.message);
            ws.close();
            return;
        }
        const { id, group } = decoded;
        const userId = id
        const orgId = JSON.parse(group).map(g => Object.keys(g)[0])

        if (!userId || !orgId) {
            console.log("Invalid token payload, closing connection.");
            ws.close();
            return;
        }

        console.log(`User ${userId} connected for orgId ${orgId}`);

        // 保存 WebSocket 连接
        clients[userId] = { ws, userId };

        // 创建 Kafka 消费者（按组织 ID 进行分配）
        createKafkaConsumer(orgId, clients);

        // WebSocket 消息监听（可选）
        ws.on("message", (message) => {
            console.log(`Received message from user ${userId}: ${message}`);
        });
        //心跳

        // 处理断开连接
        WebSocketClient.on("close", () => {
            console.log(`User ${userId} disconnected`);
            delete clients[userId];

            // 如果没有其他用户连接到该组织，销毁 Kafka 消费者
            if (!Object.values(clients).some((client) => client.orgId === orgId)) {
                console.log(`No active connections for orgId ${orgId}, destroying Kafka consumer.`);
                destroyKafkaConsumer(orgId);
            }
        });
    });
}
// 解析 Cookie 字符串
function parseCookie(cookieString) {
    return cookieString.split(';').reduce((acc, cookie) => {
        const [key, value] = cookie.trim().split('=');
        acc[key] = value;
        return acc;
    }, {});
}

module.exports = { initWebSocketServer };