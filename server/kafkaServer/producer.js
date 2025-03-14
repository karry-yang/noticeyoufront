const kafka = require("kafka-node");
const redisClient = require("../redisServer/redis");
const { connectMongoDB } = require("../mongodbServer/mongodb");
const { mysql } = require("../mysql");
const dotenv = require("dotenv");
const notificationApiHelp = require("../routers/apiHelp/notificationApiHelp");
const snowflake = require("../sonwFlakeIdServer/sonwFlakeid");
const { promisify } = require('util');
const setAsync = promisify(redisClient.set).bind(redisClient);
const mgetAsync = promisify(redisClient.mget).bind(redisClient);
const smembersAsync = promisify(redisClient.smembers).bind(redisClient);
const saddAsync = promisify(redisClient.sadd).bind(redisClient);
// 环境变量加载
const env = process.env.NODE_ENV || "development";
dotenv.config({ path: `.env.${env}` });

// 动态生产者管理
const producers = {};
const createKafkaProducer = (orgId) => {
    if (producers[orgId]) {
        console.log(`Producer for orgId ${orgId} already exists.`);
        return producers[orgId];
    }

    console.log(`Creating Kafka producer for orgId: ${orgId}`);

    const kafkaClient = new kafka.KafkaClient({
        kafkaHost: '192.168.233.128:19092,192.168.233.128:29092,192.168.233.128:39092',
        connectTimeout: 10000,
        requestTimeout: 30000,
        reconnectOnIdle: true
    });

    const kafkaProducer = new kafka.Producer(kafkaClient);

    kafkaProducer.on("ready", () => {
        console.log("Kafka producer is ready.");
    });

    kafkaProducer.on("error", (err) => {
        console.error("Kafka producer error:", err);
    });

    producers[orgId] = kafkaProducer;
    return kafkaProducer;
};






/**
 * 动态订阅用户主题并处理消息
 * @param {Object} message - 消息主体
 * @param {string} topic - 消息的主题
 * @param {string} title - 消息标题，保存再mysql中

 */
// 事务性消息发送函数
const sendTransactionalMessage = async(groupId, message, topic, title) => {
    // 构建通知内容
    // messageId:消息的key,对应redis接收人数据 
    // sendUserId:发送人  
    // sendUserGroupId:发送人组织id
    // sendUserDepartmentId:发送人部门id 
    // content:消息的主要内容 
    // messsageType:消息的类型：["personal","department","group","system-admin"] 
    //hander:处理人：个人类型使用user_id，department类型：department_name, group类型：group_name,system_admin类型：“system-admin
    // createdAt:时间
    let producer
    if (producers[groupId]) {
        console.log(`Producer for orgId ${groupId} already exists.`);
        producer = producers[groupId]
    } else {
        producer = createKafkaProducer(groupId)
    }
    const { sendUserId, content, sendUserGroupId, sendUserDepartmentId, createdAt, handler } = message;
    console.log("传入的message:", message)
    let mysqlConnection;
    let mongoSession;
    const notification_id = snowflake.generate();
    let messageId;

    try {
        // 1. 开启 MongoDB 会话
        const client = await connectMongoDB();
        const db = client.db("notice_you");
        mongoSession = client.startSession();
        mongoSession.startTransaction();
        console.log("[MongoDB] Transaction started.");

        // 2. 存储消息内容到 MongoDB
        const messagesCollection = db.collection("notifiction_content");
        const messageDocument = {
            content,
            sendUserId,
            sendUserGroupId,
            sendUserDepartmentId,
            isDeleted: 1, //状态描述
            createdAt
        };
        const result = await messagesCollection.insertOne(messageDocument, { session: mongoSession });
        messageId = result.insertedId.toString();
        console.log("[MongoDB] Message inserted with ID:", messageId);

        // 3. 开启 MySQL 事务
        mysqlConnection = await mysql.getConnection();
        await mysqlConnection.beginTransaction();
        console.log("[MySQL] Transaction started.");
        const recipient_ids = handler
        console.log(handler)
            // 4. 存储消息元数据到 MySQL
            //notification_id, notification_create_user_id, notification_title, notification_content_id, recipient_ids
        await notificationApiHelp.insertNotificationByUserId(notification_id, sendUserId, title, messageId, recipient_ids);
        //解析受理人字符串，存入notification_recipitens
        console.log("[MySQL] Notification metadata stored with notification ID:", notification_id);

        // 5. 存储未发送的用户列表到 Redis
        const recipientsKey = `message:${messageId}:handlers`;
        await saddAsync(recipientsKey, handler);
        await redisClient.expire(recipientsKey, 24 * 60 * 60); // 设置为 1 天
        console.log(`[Redis] Recipient list stored under key: ${recipientsKey}`);

        // 6. 发送消息到 Kafka (事务性)
        await new Promise((resolve, reject) => {
            producer.send(
                [{ topic, messages: JSON.stringify({ messageId, sendUserId, content }) }],
                (err, data) => {
                    if (err) {
                        console.error("[Kafka] Failed to send message:", err);
                        return reject(new Error("Kafka message send failed"));
                    }
                    console.log("[Kafka] Message sent successfully:", data);
                    resolve();
                }
            );
        });

        // 7. 提交事务
        await mongoSession.commitTransaction();
        await mysqlConnection.commit();
        console.log("[Transaction] All transactions committed successfully.");
    } catch (error) {
        console.error("[Error] Transaction failed:", error);

        // 回滚 MongoDB 事务
        if (mongoSession) {
            await mongoSession.abortTransaction();
            console.log("[MongoDB] Transaction rolled back.");
        }

        // 回滚 MySQL 事务
        if (mysqlConnection) {
            await mysqlConnection.rollback();
            console.log("[MySQL] Transaction rolled back.");
        }

        // 清理 Redis 中的临时数据
        if (messageId) {
            await redisClient.del(`message:${messageId}:recipients`);
            console.log(`[Redis] Cleared recipient list for message ID: ${messageId}`);
        }
    } finally {
        // 释放资源
        if (mongoSession) mongoSession.endSession();
        if (mysqlConnection) mysqlConnection.release();
    }
};

module.exports = {
    sendTransactionalMessage,
};