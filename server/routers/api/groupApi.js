const express = require('express');
const router = express.Router(); // 使用 Router 实例
const { use } = require('bcrypt/promises');
const apiHelp = require('../apiHelp/groupApiHelp')
const userApiHelp = require('../apiHelp/userApiHelp')
const StatusCodes = require('../../utils/statusCodes');
const { connectMongoDB, ObjectId } = require('../../mongodbServer/mongodb');
const notificationApiHelp = require('../apiHelp/notificationApiHelp')
const snowflake = require('../../sonwFlakeIdServer/sonwFlakeid')
const { sendTransactionalMessage } = require('../../kafkaServer/producer'); // 引入生产者逻辑
const { consumeMessage } = require('../../kafkaServer/consumer'); // 引入消费者逻辑
require('../../utils/authenticate')
require('util');

// 组织修改请求
router.post('/sentUserGroupChangeRequest', async(req, res, next) => {
    const userId = req.userId;
    //获取原有的组织对象抽取组织id
    const oldGroup = JSON.parse(req.group);
    const [groupId] = oldGroup.map(group => Object.keys(group)[0]); // 提取每个对象的键
    //获取传入的新组织代码
    const { newGroupCode, joinGroupReason } = req.body;

    const roles = req.roleCodes
    const roleCodes = roles.split(',').map(role => role.trim());
    //获取用户类型
    const types = req.types
    const userTypes = types.split(',').map(type => type.trim());
    console.log(userTypes)
    console.log(groupId)


    //判断用户类型，是否原先属于某个组织以及检验数据合法
    if (Array.isArray(userTypes) && newGroupCode !== '' && newGroupCode !== null) {
        if (userTypes.includes("GROUP-USER")) {
            // 查询用户所在的组织
            try {
                // 验证组织是否存在
                const [newGroupObj] = await apiHelp.checkGroupByGroupCode(newGroupCode);
                const [oldGroupObj] = await apiHelp.checkGroupByGrouId(groupId);
                //输出新旧的组织
                console.log("newGroupObj:", newGroupObj, "oldGroupObj:", oldGroupObj)
                if (newGroupObj === null || Object.keys(newGroupObj).length === 0 || oldGroupObj === null || Object.keys(oldGroupObj).length === 0) {
                    return res.error(StatusCodes.INTERNAL_SERVER_ERROR, `原组织或者新组织不存在!稍后重试`, null);
                }

                // 构建通知内容
                // messageId:消息的key,对应redis接收人数据 
                // sendUserId:发送人  
                // sendUserGroupId:发送人组织id
                // sendUserDepartmentId:发送人部门id 
                // content:消息的主要内容 
                // messsageType:消息的类型：["personal","department","group","system-admin"] 
                //hander:处理人：个人类型使用user_id，department类型：department_name, group类型：group_name,system_admin类型：“system-admin
                // time:时间

                //创建消息id
                const messageId = snowflake.generate();
                //个人申请加入组织，消息类型使用personal，在redis中保存人事部门负责人的id(组织管理者指派的部门用户)
                let handersArr = []
                handersArr.push(newGroupObj.group_leader_id)
                const message = {
                    messageId: `${messageId}`,
                    sendUserId: `${userId}`,
                    sendUserGroupId: `${newGroupObj.group_id}`,
                    sendUserDepartmentId: `${oldGroupObj.group_id}`,
                    content: `申请加入组织 ${newGroupObj.group_name}:${newGroupObj.group_id} -> ${oldGroupObj.group_name}:${oldGroupObj.group_id} -- 理由: ${joinGroupReason}`,
                    messsageType: "personal",
                    handler: handersArr,
                    createdAt: new Date().toISOString(),
                };



                // 发送消息到 Kafka

                try {
                    //const sendTransactionalMessage = async(groupId, message, topic, title
                    await sendTransactionalMessage(newGroupObj.group_id, message, `topic-${newGroupObj.group_id}`, "加入请求");
                    console.log("groupApi中传入生产者的message", message)
                    console.log(`消息发送成功: ${JSON.stringify(message)}`);
                    // await consumeMessage(newGroupObj.group_size, newGroupObj.group_id, "null", roleCodes)
                } catch (kafkaError) {
                    console.error('消息发送到 Kafka 失败:', kafkaError);
                    return res.error(StatusCodes.INTERNAL_SERVER_ERROR, `消息发送失败`, null);
                }

                return res.success(StatusCodes.SUCCESS, `请求已发送`);

            } catch (error) {
                console.error('Error:', error);
                return res.error(StatusCodes.INTERNAL_SERVER_ERROR, `服务器错误，稍后重试`, null);
            }
        }
    } else {
        return res.error(StatusCodes.INTERNAL_SERVER_ERROR, `输入错误，稍后重试`, null);
    }


});




module.exports = router; // 确保导出的是 router