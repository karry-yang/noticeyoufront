const express = require('express');
const router = express.Router(); // 使用 Router 实例
const { use } = require('bcrypt/promises');
const apiHelp = require('../apiHelp/departmentApiHelp')
const groupApiHelp = require('../apiHelp/groupApiHelp')
const notificationApiHelp = require('../apiHelp/notificationApiHelp')
const StatusCodes = require('../../utils/statusCodes');
const { connectMongoDB, ObjectId } = require('../../mongodbServer/mongodb');
const snowflake = require('../../sonwFlakeIdServer/sonwFlakeid')
const { sendMessage, determineTopicAndPartition } = require('../../kafkaServer/producer'); // 引入生产者逻辑
const { consumeMessage } = require('../../kafkaServer/consumer'); // 引入消费者逻辑
require('../../utils/authenticate')
require('util');

router.post('/getAllDepartmentsByUserGroupId', async(req, res, next) => {
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
router.post('/sentUserDepartmentChangeRequest', async(req, res, next) => {
    const userId = req.userId;
    const groups = JSON.parse(req.group);
    const roles = req.roleCodes
    const roleCodes = roles.split(',').map(role => role.trim());
    const [groupId] = groups.map(group => Object.keys(group)[0]); // 提取每个对象的键
    console.log(groupId)
    const { newDepartmentId, joinDepartmentReason, oldDepartmentId } = req.body;
    console.log(newDepartmentId, joinDepartmentReason, oldDepartmentId)
    try {
        // 验证新旧部门是否存在
        const [newDepartment] = await apiHelp.checkDepartmentByDepartmentId(newDepartmentId);
        console.log(newDepartment)
        const [oldDepartment] = await apiHelp.checkDepartmentByDepartmentId(oldDepartmentId);
        console.log(oldDepartment)
        const group = await groupApiHelp.checkGroupByGrouId(groupId);
        console.log(group[0])
        if (newDepartment === null || oldDepartment === null || Object.keys(newDepartment).length === 0 || Object.keys(oldDepartment).length === 0) {
            return res.error(StatusCodes.INTERNAL_SERVER_ERROR, `部门不存在!稍后重试`, null);
        }

        if (group.length === 0) {
            return res.error(StatusCodes.INTERNAL_SERVER_ERROR, `组织不存在!稍后重试`, null);
        }

        const groupObj = group[0];

        // 构建通知内容
        const message = {
            userId,
            groupId,
            departmentId: oldDepartment.department_id,
            newDepartmentId,
            oldDepartmentId,
            joinDepartmentReason,
            content: `申请修改部门 ${oldDepartmentId}:${oldDepartment.department_name} -> ${newDepartmentId}:${newDepartment.department_name} -- 理由: ${joinDepartmentReason}`,
            createdAt: new Date().toISOString(),
        };

        // 保存到 MongoDB 并创建通知数据
        let client;
        try {
            client = await connectMongoDB();
            const db = client.db('notice_you');
            const collection = db.collection('notifiction_content');
            const result = await collection.insertOne({
                content: message.content,
                created_at: new Date(),
                sender: userId,
                is_read: true,
            });
            const notificationContentId = result.insertedId.toString();
            const notificationId = snowflake.generate();
            await notificationApiHelp.insertNotificationByUserId(notificationId, userId, JSON.stringify(message.content), notificationContentId);

            // // 动态确定 Kafka 的主题与分区
            // const { topic, key } = determineTopicAndPartition(
            //     groupObj.group_size,
            //     groupObj.id,
            //     oldDepartment.department_id,
            //     userType
            // );

            // 发送消息到 Kafka
            try {
                await sendMessage(message, groupObj.group_size, roleCodes, groupId, oldDepartmentId);
                console.log(`消息发送成功: ${JSON.stringify(message)}`);
                await consumeMessage(groupObj.group_size, groupId, oldDepartmentId, roleCodes)
            } catch (kafkaError) {
                console.error('消息发送到 Kafka 失败:', kafkaError);
                return res.error(StatusCodes.INTERNAL_SERVER_ERROR, `消息发送失败`, null);
            }

            return res.success(StatusCodes.SUCCESS, `请求已发送`, result);
        } catch (error) {
            console.error('Database error:', error);
            return res.error(StatusCodes.INTERNAL_SERVER_ERROR, `服务器错误，稍后重试`, null);
        } finally {
            if (client) {
                await client.close();
            }
        }
    } catch (error) {
        console.error('Error:', error);
        return res.error(StatusCodes.INTERNAL_SERVER_ERROR, `服务器错误，稍后重试`, null);
    }
});


router.post('/updateDepartment', async(req, res, next) => {
    const userId = req.userId;
    const { newDepartmentId, joinGroupReason } = req.body
    try {
        const result = await apiHelp.checkAllDepartmentsByGroupId(newDepartmentId)
        if (result.length !== 0) {
            res.success(StatusCodes.SUCCESS, `checkAllDepartmentsByGroupId`, result)
        }
    } catch (error) {
        res.error(StatusCodes.INTERNAL_SERVER_ERROR, `${userId}--/getAllHobitByUserId--sevenDaysHobitCompletionPercentage--checkAllReductionHobitsByUserId`, null)
        next(error)
    }
});
module.exports = router; // 确保导出的是 router