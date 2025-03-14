const express = require('express');
const router = express.Router(); // 使用 Router 实例
const { use } = require('bcrypt/promises');
const redisClient = require('../../redisServer/redis'); // 引入 Redis 客户端
const apiHelp = require('../apiHelp/settingApiHelp')
const { authenticate } = require('../../utils/authenticate')
const { promisify } = require('util');

// 将 Redis 的 `set` 函数转换为 Promise 形式，方便使用 async/await
router.get("/getTaskNoteByTaskId", async(req, res, next) => {
    const { task_id } = req.query; // 通过查询参数接收 task_id
    console.log("task_id", task_id)
    try {

        const noteList = await apiHelp.checkAllNotesByTaskId(task_id);
        res.status(200).json({ noteList: noteList });
    } catch (error) {
        next(error)

    }

})
module.exports = router; // 确保导出的是 router