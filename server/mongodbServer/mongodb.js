const { MongoClient, ObjectId } = require('mongodb');
const dotenv = require('dotenv');

// 根据环境加载配置文件
dotenv.config({ path: `.env.${process.env.NODE_ENV || 'development'}` });

const mongoURI = process.env.MONGODB_URI;
if (!mongoURI) {
    throw new Error('MONGODB_URI 未定义');
}

let mongoClient; // 全局客户端实例

/**
 * 连接到 MongoDB 数据库
 * @returns {Promise<MongoClient>}
 */
const connectMongoDB = async() => {
    try {
        // 如果 mongoClient 已存在且客户端已连接，则直接返回
        if (mongoClient && mongoClient.topology && mongoClient.topology.isConnected()) {
            return mongoClient;
        }

        // 创建新的 MongoClient 实例并连接
        mongoClient = new MongoClient(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true });
        await mongoClient.connect();
        console.log('MongoDB 连接成功');

        // 监听进程退出事件，优雅关闭连接
        process.once('SIGINT', closeMongoDB);
        process.once('SIGTERM', closeMongoDB);

        return mongoClient;
    } catch (error) {
        console.error('MongoDB 连接失败:', error);
        throw error;
    }
};


const closeMongoDB = async() => {
    if (mongoClient) {
        try {
            await mongoClient.close();
            console.log('MongoDB 连接已关闭');
        } catch (error) {
            console.error('关闭 MongoDB 连接时出错:', error);
        } finally {
            mongoClient = null; // 确保客户端清空
        }
    }
};

module.exports = { connectMongoDB, closeMongoDB, ObjectId };