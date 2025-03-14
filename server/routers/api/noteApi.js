const express = require('express');
const router = express.Router(); // 使用 Router 实例
const { use } = require('bcrypt/promises');
const apiHelp = require('../apiHelp/noteApiHelp')
const StatusCodes = require('../../utils/statusCodes');
require('../../utils/authenticate')
require('util');
router.get("/getTaskNoteByTaskId", async(req, res, next) => {
    const { task_id } = req.userId; // 通过查询参数接收 task_id
    try {
        const noteList = await apiHelp.checkAllNotesByTaskId(task_id);
        res.success(StatusCodes.INTERNAL_SERVER_ERROR, `${user_id}--/getTaskNoteByTaskId--checkAllNotesByTaskId`, noteList)
    } catch (error) {
        res.error(StatusCodes.INTERNAL_SERVER_ERROR, `${user_id}--/getTaskNoteByTaskId--checkAllNotesByTaskId`, null)
        next(error)

    }

})
module.exports = router; // 确保导出的是 router