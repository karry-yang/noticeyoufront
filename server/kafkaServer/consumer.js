const kafka = require("kafka-node");
const { promisify } = require("util");
const redisClient = require("../redisServer/redis");

// Redis 异步方法
const smembersAsync = promisify(redisClient.smembers).bind(redisClient);

// 动态 Kafka 消费者管理
const consumers = {};
const kafkaClient = new kafka.KafkaClient({
    kafkaHost: "192.168.233.128:19092,192.168.233.128:29092,192.168.233.128:39092",
});

// 创建 Kafka 消费者实例
let comsumer
const createKafkaConsumer = (orgId, clients) => {
    if (consumers[orgId]) {
        console.log(`Kafka consumer for orgId ${orgId} already exists.`);
        comsumer = consumers[orgId];
    }
    console.log(`Creating Kafka consumer for orgId: ${orgId}`);
    const consumer = new kafka.Consumer(
        kafkaClient, [{ topic: `topic-${orgId}` }], { autoCommit: true }
    );
    console.log("成功创建消费者")
        // 消息处理逻辑
    consumer.on("message", async(message) => {
        try {
            const parsedMessage = JSON.parse(message.value);
            const { messageId, senderId, content } = parsedMessage;

            // 通过 Redis 获取需要处理此消息的用户
            let handlers = await smembersAsync(`message:${messageId}:handlers`);
            console.log("查出需要发送的用户：", handlers)
                // handlers = JSON.parse(handlers)
            handlers.forEach((userId) => {
                if (clients[userId]) {
                    clients[userId].ws.send(JSON.stringify({ senderId, content }));
                    console.log(`Message sent to user ${userId}`);
                }
            });
        } catch (err) {
            console.error(`Error processing message for orgId ${orgId}:`, err);
        }
    });

    consumer.on("error", (err) => {
        console.error(`Error in Kafka consumer for orgId ${orgId}:`, err);
    });

    consumers[orgId] = consumer;
    return consumer;
};

// 销毁消费者实例
const destroyKafkaConsumer = (orgId) => {
    if (consumers[orgId]) {
        consumers[orgId].close(true, () => {
            console.log(`Kafka consumer for orgId ${orgId} has been closed.`);
            delete consumers[orgId];
        });
    }
};

module.exports = { createKafkaConsumer, destroyKafkaConsumer };