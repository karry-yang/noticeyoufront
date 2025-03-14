const { mysql, getMySqlConnection } = require('../../mysql');

// 创建通知表和通知用户关联表
async function insertNotificationByUserId(notification_id, notification_create_user_id, notification_title, notification_content_id, recipient_ids) {
    const sqlInsertNotification = `
        INSERT INTO \`notification\` (
            \`notification_id\`, 
            \`notification_create_user_id\`, 
            \`notification_title\`, 
            \`notifications_content\`
        ) 
        VALUES (?, ?, ?, ?)
    `;

    const sqlInsertRecipient = `
        INSERT INTO \`notification_recipients\` (
            \`notification_recipients_id\`,
            \`notification_id\`,
            \`recipient_id\`
        ) 
        VALUES (?, ?, ?)
    `;

    const connection = await getMySqlConnection();
    try {
        await connection.beginTransaction(); // 开始事务

        // 插入通知
        const result = await connection.query(sqlInsertNotification, [notification_id, notification_create_user_id, notification_title, notification_content_id]);

        // 插入通知接收者
        for (let recipient_id of recipient_ids) {
            const notificationRecipientsId = `${notification_id}_${recipient_id}`; // 创建唯一的通知接收者ID
            await connection.query(sqlInsertRecipient, [notificationRecipientsId, notification_id, recipient_id]);
        }

        await connection.commit(); // 提交事务
        return result;
    } catch (error) {
        await connection.rollback(); // 回滚事务
        console.error('Transaction failed:', error);
        throw error;
    } finally {
        connection.release(); // 释放连接
    }
}

module.exports = {
    insertNotificationByUserId, // 插入通知和接收者
};