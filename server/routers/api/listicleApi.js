const express = require('express');
const router = express.Router();
const redisClient = require('../../redisServer/redis');
const apiHelp = require('../apiHelp/listicleApiHelp');
const nestedListicles = require('../../utils/nestedListicles');
const StatusCodes = require('../../utils/statusCodes');
const { promisify } = require('util');
const setAsync = promisify(redisClient.set).bind(redisClient);
const mgetAsync = promisify(redisClient.mget).bind(redisClient);
const getListiclesByUserId = async(userId) => {
    const pattern = `${userId}:listicle:*`;
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

const storeListiclesInRedis = async(listiclesList, user_id) => {
    for (const listicle of listiclesList) {
        const { listicle_id, ...otherData } = listicle;
        const listicleData = { user_id, listicle_id, ...otherData };
        const key = `${user_id}:listicle:${listicle_id}`;

        try {
            await setAsync(key, JSON.stringify(listicleData));
            console.log(`Stored listicle ${listicle_id} with key ${key}`);
        } catch (err) {
            console.error(`Failed to store listicle ${listicle_id}:`, err);
        }
    }
};

router.post("/getListiclesByUserId", async(req, res, next) => {
    const user_id = req.userId; // 从请求中获取 user_id
    try {
        let listiclesList = null;

        // 尝试从 Redis 缓存获取数据
        try {
            const cachedListiclesList = await getListiclesByUserId(user_id);
            if (cachedListiclesList.length > 0) {
                const parsedListicles = cachedListiclesList.map(listicle => JSON.parse(listicle));
                listiclesList = await nestedListicles(parsedListicles);
            }
        } catch (redisError) {
            console.error("Redis get error:", redisError);
        }

        // 如果缓存中没有，查询数据库
        if (!listiclesList) {
            listiclesList = await apiHelp.checkAllListiclesByUserId(user_id);

            // 检查返回数据是否为数组且非空
            if (Array.isArray(listiclesList) && listiclesList.length > 0) {
                try {
                    // 缓存数据
                    await storeListiclesInRedis(listiclesList[0], user_id);
                    listiclesList = await nestedListicles(listiclesList);
                } catch (redisError) {
                    console.error("Error caching listicles:", redisError);
                }
            }
        }

        // 返回成功响应
        res.success(StatusCodes.SUCCESS, `${user_id}--/getListiclesByUserId--checkAllListiclesByUserId`, listiclesList);
    } catch (error) {
        // 错误处理
        res.error(StatusCodes.INTERNAL_SERVER_ERROR, `${user_id}--/getListiclesByUserId--checkAllListiclesByUserId`, null);
        next(error); // 将错误传递给全局错误处理
    }
});

module.exports = router;