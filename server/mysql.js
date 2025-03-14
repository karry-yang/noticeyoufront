const dotenv = require('dotenv');
const mysql = require('mysql2');

// 根据当前环境加载对应的 .env 文件
const env = process.env.NODE_ENV || 'development';
dotenv.config({ path: `.env.${env}` });

// 创建 MySQL 连接池
const mysqlPool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10, // 最大连接数
    queueLimit: 0 // 排队请求数量（0 表示不限制）
}).promise();

// 获取数据库连接
async function getMySqlConnection() {
    try {
        const connection = await mysqlPool.getConnection(); // 从连接池获取连接
        return connection;
    } catch (error) {
        console.error('mysql数据库连接错误:', error.message);
        throw new Error('Database connection failed');
    }
}

// 导出模块
module.exports = {
    getMySqlConnection: getMySqlConnection,
    mysql: mysqlPool
};