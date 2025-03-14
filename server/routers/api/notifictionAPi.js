const express = require('express');
const router = express.Router(); // 使用 Router 实例
const { use } = require('bcrypt/promises');
const apiHelp = require('../apiHelp/notificationApiHelp')
const StatusCodes = require('../../utils/statusCodes');
const { connectMongoDB, ObjectId } = require('../../mongodbServer/mongodb');

require('../../utils/authenticate')
require('util');



//
async function storeNotificationContent(content) {
    const client = await connectMongoDB()
    try {
        // await client.connect();
        const db = client.db('notice_you');
        const collection = db.collection('notifications-contents');
        const result = await collection.insertOne({ content });
        return result.insertedId; // 返回 MongoDB 文档 ID
    } catch (err) {
        console.error('Error storing content to MongoDB:', err);
        throw err;
    } finally {
        await client.close();
    }
}

router.post('/getAllDepartmentByUserGroupId', async(req, res, next) => {
    const userId = req.userId;
    const { userGroupId } = req.body
    try {
        const result = await apiHelp.checkAllDepartmentsByGroupId(userGroupId)
        if (result.length !== 0) {
            res.success(StatusCodes.SUCCESS, `checkAllDepartmentsByGroupId`, result)
        }

    } catch (error) {

        res.error(StatusCodes.INTERNAL_SERVER_ERROR, `${userId}--/getAllHobitByUserId--sevenDaysHobitCompletionPercentage--checkAllReductionHobitsByUserId`, null)
        next(error)
    }
});
//转发用户修改部门的请求到kafka,kafka通知上级用户
router.post('/sentUserDepartmentRequest', async(req, res, next) => {
    const userId = req.userId;
    const { newDepartmentId, joinGroupReason } = req.body
        //首先获取joinGroupReason保存mongodb，返回地址
        //将请求存储在数据库--创建通知数据和通知接收数据
    try {
        const contentMongoDBId = await storeNotificationContent(joinGroupReason)
        const result = await insertNotificationByUserId(notification_id, notification_create_user_id, notification_title, contentMongoDBId, create_time);

    } catch (error) {

    }
})

module.exports = router; // 确保导出的是 router