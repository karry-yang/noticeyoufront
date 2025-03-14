const express = require('express');
const router = express.Router();
const redisClient = require('../../redisServer/redis');
const apiHelp = require('../apiHelp/tagApiHelp');
const nestedTags = require('../../utils/nestedTags');
const StatusCodes = require('../../utils/statusCodes');
const { promisify } = require('util');
const setAsync = promisify(redisClient.set).bind(redisClient);
const mgetAsync = promisify(redisClient.mget).bind(redisClient);
const getTagsByUserId = async(userId) => {
    const pattern = `${userId}:tag:*`;
    let cursor = '0';
    const results = [];
    do {
        const reply = await redisClient.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = reply[0];
        const keys = reply[1];

        // 使用 mget 获取所有键的值
        if (keys.length > 0) {
            const values = await mgetAsync(keys);
            results.push(...values.filter(v => v)); // 过滤掉空值
        }
    } while (cursor !== '0');

    return results;
};


const storeTagsInRedis = async(tagsList, user_id) => {
    for (const tag of tagsList) {
        const { tag_id, ...otherData } = tag;
        const tagData = { user_id, tag_id, ...otherData };
        const key = `${user_id}:tag:${tag_id}`;

        try {
            await setAsync(key, JSON.stringify(tagData));
            console.log(`Stored task ${tag_id} with key ${key}`);
        } catch (err) {
            console.error(`Failed to store task ${tag_id}:`, err);
        }
    }
};
router.post("/getTagsByUserId", async(req, res, next) => {
    const user_id = req.userId; // 从请求中获取 user_id
    try {
        let tagsList = null;

        // 尝试从缓存中获取数据
        try {
            const cachedTagsList = await getTagsByUserId(user_id);
            if (cachedTagsList.length > 0) {
                const parsedTags = cachedTagsList.map(tag => JSON.parse(tag));
                tagsList = await nestedTags(parsedTags);
            }
        } catch (redisError) {
            console.error("Redis get error:", redisError);
        }

        // 如果缓存中没有，查询数据库
        if (!tagsList) {
            tagsList = await apiHelp.checkAllTagsByUserId(user_id);
            try {
                // 更新缓存
                await storeTagsInRedis(tagsList, user_id);
                tagsList = await nestedTags(tagsList);
            } catch (redisError) {
                console.error("Error caching tags:", redisError);
            }
        }

        // 返回成功响应
        // console.log(tagsList)
        res.success(StatusCodes.SUCCESS, `${user_id}--/getTagsByUserId--insertCheckinLogByCheckinId`, tagsList);
    } catch (error) {
        // 错误处理
        res.error(StatusCodes.INTERNAL_SERVER_ERROR, `${user_id}--/insertCheckinDailyLog--insertCheckinLogByCheckinId`, null);
        next(error); // 将错误传递给全局错误处理
    }
});


module.exports = router;