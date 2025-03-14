const express = require('express');
const router = express.Router();
const redisClient = require('../../redisServer/redis');
const apiHelp = require('../apiHelp/taskApiHelp');
const nestedTasks = require('../../utils/nestedTasks');
const StatusCodes = require('../../utils/statusCodes');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' }); // 指定临时文件存储目录
const ossClient = require('../../ossServer/ossConfig');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const { json } = require('stream/consumers');
const setAsync = promisify(redisClient.set).bind(redisClient);
const mgetAsync = promisify(redisClient.mget).bind(redisClient);
const { connectMongoDB, ObjectId } = require('../../mongodbServer/mongodb');
const { start } = require('repl');
// const {  } = require('mongodb');
const getTasksByUserId = async(userId) => {
    const pattern = `${userId}:task:*`;
    let cursor = '0';
    const results = [];

    do {
        const reply = await redisClient.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = reply[0];
        const keys = reply[1];

        // 使用 mget 获取键的值
        if (keys.length > 0) {
            const values = await mgetAsync(keys);
            results.push(...values.filter(value => value)); // 去除空值
        }
    } while (cursor !== '0');

    return results;
};

const storeTasksInRedis = async(tasksList, user_id) => {
    for (const task of tasksList) {
        const { task_id, ...otherData } = task;
        const taskData = { user_id, task_id, ...otherData };
        const key = `${user_id}:task:${task_id}`;

        try {
            await setAsync(key, JSON.stringify(taskData));
            console.log(`Stored task ${task_id} with key ${key}`);
        } catch (err) {
            console.error(`Failed to store task ${task_id}:`, err);
        }
    }
};

router.post('/getUserTasksById/:type', async(req, res, next) => {

    const user_id = req.userId;
    const type = req.params.type;

    try {
        let tasksList;
        try {
            const cachedTasks = await getTasksByUserId(user_id);

            if (cachedTasks && cachedTasks.length > 0) {
                // 将每个缓存数据解析为 JSON 格式
                tasksList = cachedTasks.map(task => JSON.parse(task));
            } else {
                tasksList = await apiHelp.checkAllTasksByUserId(user_id);
                await storeTasksInRedis(tasksList, user_id);
            }
        } catch (error) {
            console.error("Redis error:", error);
            res.error(StatusCodes.INTERNAL_SERVER_ERROR, `${user_id}--/getUserTasksById/:${type}--redisClient.get(tasksList:${user_id})`, null);
            return next();
        }

        switch (type) {
            case 'allTasks':
                try {
                    tasksList = await nestedTasks(tasksList);
                    res.success(StatusCodes.SUCCESS, `${user_id}--/getUserTasksById/:${type}--tasksList`, tasksList);
                } catch (error) {
                    res.error(StatusCodes.INTERNAL_SERVER_ERROR, `${user_id}--/getUserTasksById/:${type}--tasksList`, null);
                    next();
                }
                break;
            case 'todayTasks':
                try {
                    const today = new Date();
                    today.setUTCHours(0, 0, 0, 0);
                    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

                    const todayTasks = tasksList.filter(task => {
                        const taskDate = new Date(task.task_start_time);
                        return taskDate >= today && taskDate < tomorrow;
                    });

                    todayTasks = await nestedTasks(todayTasks);
                    res.success(StatusCodes.SUCCESS, `${user_id}--/getUserTasksById/:${type}--tasksList`, todayTasks);
                } catch (error) {
                    res.error(StatusCodes.INTERNAL_SERVER_ERROR, `${user_id}--/getUserTasksById/:${type}--tasksList`, null);
                    next();
                }
                break;
            case 'tomorrowTasks':
                try {
                    const today = new Date();
                    today.setUTCHours(0, 0, 0, 0);
                    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
                    const dayAfterTomorrow = new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000);

                    let tomorrowTasks = tasksList.filter(task => {
                        const taskDate = new Date(task.task_start_time);
                        return taskDate >= tomorrow && taskDate < dayAfter;
                    });

                    tomorrowTasks = await nestedTasks(tomorrowTasks);
                    res.success(StatusCodes.SUCCESS, `${user_id}--/getUserTasksById/:${type}--tasksList`, tomorrowTasks);
                } catch (error) {
                    res.error(StatusCodes.INTERNAL_SERVER_ERROR, `${user_id}--/getUserTasksById/:${type}--tasksList`, null);
                    next();
                }
                break;
            case 'assignedMeTasks':
                // Implement logic for assigned tasks
                break;
            case 'weekTasks':
                // Implement logic for week's tasks
                break;
            case 'monthTasks':
                // Implement logic for month's tasks
                break;
            case 'Abstract':
                const abstractTasks = await userApiHelp.checkAbstractList(user_id);
                return res.status(200).json({ tasksList: abstractTasks });
            case 'collectingBox':
                const collectingBoxTasks = await userApiHelp.checkCollectingBoxTasksList(user_id);
                return res.status(200).json({ tasksList: collectingBoxTasks });
            default:
                return res.status(200).json({ tasksList });
        }
    } catch (error) {
        res.error(StatusCodes.INTERNAL_SERVER_ERROR, `${user_id}--/getUserTasksById/:${type}--参数错误`, null);
        next();
    }
});

const findTaskById = (tasks, taskId) => {
    for (const task of tasks) {
        if (task.task_id === taskId) return task;
        if (task.children && task.children.length > 0) {
            const foundTask = findTaskById(task.children, taskId);
            if (foundTask) return foundTask;
        }
    }
    return null;
};

router.post('/getTaskByTaskId/:currentTaskId', async(req, res, next) => {
    //获取任务详情，任务数据，标签数据，清单数据，注意事项数据，。。。。
    // 获取任务id，查询reidis是否有任务详情文本，没有则查询mongodb,并且存入redis
    const user_id = req.userId;
    const { currentTaskId } = req.params;
    console.log(currentTaskId)
    let tasksList = []; // 初始化为一个空数组
    let task_text_id;
    let newTask;
    try {
        //用户登录会将任务数据缓存在redis中不查询数据库直接从redis中获取任务数据
        const cachedTasks = await getTasksByUserId(user_id);
        if (cachedTasks && cachedTasks.length > 0) {
            tasksList = cachedTasks.map(task => JSON.parse(task));
            tasksList = await nestedTasks(tasksList);

        }
        console.log("taskList", tasksList.length)
        let task = await findTaskById(tasksList, currentTaskId); // 不再使用 await
        console.log("task", task)
        const task_text_id_str = task.task_text_id; // 假设 task_text_id 是字符串
        if (!/^[0-9a-fA-F]{24}$/.test(task_text_id_str)) {
            throw new Error("task_text_id 格式不合法，无法转换为 ObjectId");
        }
        const task_text_id = new ObjectId(task_text_id_str); // 确保 task_text_id_str 是正确的格式
        // console.log("task", task)
        // console.log("task_text_id", task_text_id)
        console.log("转换后的 ObjectId:", task_text_id.toString());
        try {

            const client = await connectMongoDB();
            const db = client.db('notice_you');
            const collection = db.collection('task_text');

            // 插入示例文档
            // const insertResult = await collection.insertOne({ name: "Alice", age: 25 });
            // console.log("插入结果:", insertResult);

            // 查询示例文档
            // const queryResult = await collection.findOne({ user_id: user_id, task_id: currentTaskId });
            const queryResult = await collection.findOne({ _id: task_text_id });
            console.log("查询结果:", queryResult);
            console.log("typeof_task_text_id:", typeof(task_text_id));

            newTask = {...task, task_text: queryResult };
            //缓存
            await setAsync(`${user_id}:task:${currentTaskId}`, JSON.stringify(newTask))
        } catch (error) {
            console.error('mongodb数据库操作失败:', error);
        }
        if (!task) {
            return res.error(StatusCodes.NOT_FOUND, `${user_id}--/getTaskByTaskId/:${currentTaskId}--task not found`, null);
        }

        res.success(StatusCodes.SUCCESS, `${user_id}--/getTaskByTaskId/:${currentTaskId}--checkTaskByTaskId`, newTask);
    } catch (error) {
        console.log(error)
        res.error(StatusCodes.INTERNAL_SERVER_ERROR, `${user_id}--/getTaskByTaskId/:${currentTaskId}--checkTaskByTaskId`, null);
        next();
    }
});

router.post("/updateTaskTitleByTaskId", async(req, res, next) => {
    const user_id = req.userId;
    const { task_id, task_title } = req.body;
    console.log(`Updating task: task_id=${task_id}, task_title=${task_title}`);

    try {
        const result = await apiHelp.updateTaskTitleByTaskId(user_id, task_id, task_title);

        if (result[0].affectedRows > 0) {
            res.success(StatusCodes.SUCCESS, `${user_id}--/updateTaskTitleByTaskId--updateTaskTitleByTaskId`, result);

            try {
                const tasksList = await apiHelp.checkAllTasksByUserId(user_id);
                await setAsync(`${user_id}:task:${task_id}`, JSON.stringify(tasksList));
                console.log("缓存更新成功");
            } catch (cacheError) {
                console.error("缓存更新失败:", cacheError);
            }
        } else {
            res.error(StatusCodes.NOT_FOUND, `${user_id}--/updateTaskTitleByTaskId--no rows affected`, null);
        }
    } catch (error) {
        console.error("任务更新失败:", error);
        res.error(StatusCodes.INTERNAL_SERVER_ERROR, `${user_id}--/updateTaskTitleByTaskId--updateTaskTitleByTaskId`, null);
        next();
    }
});
router.post('/addTask', upload.array('fileList'), (req, res) => {
    const user_id = req.userId; // 确保在其他中间件中解析并设置 userId
    // console.log(req)
    try {
        // 从请求体中解构出任务数据
        const { addTaskTitle, selectedWeeklyDays, selectedMonthlyDays, timePickerList, addTaskTags, addTaskListiclesList, addTaskUrgency } = req.body;

        // 将文件信息保存到数组
        const uploadedFiles = req.files.map(file => ({
            originalName: file.originalname,
            path: file.path,
            mimeType: file.mimetype,
            size: file.size,
        }));

        // 打印任务标题和文件列表
        console.log("Task Title:", addTaskTitle);
        console.log("Uploaded Files:", uploadedFiles);

        // 将信息存入 Redis（假设 redisClient.setAsync 支持异步）
        //  redisClient.setAsync(`${user_id}--upload`, JSON.stringify(uploadedFiles));

        // 返回成功响应
        res.success(StatusCodes.OK, `Task added for user: ${user_id}`, uploadedFiles);
    } catch (error) {
        console.error("Error in /addTask:", error);
        // 返回错误响应
        res.error(StatusCodes.INTERNAL_SERVER_ERROR, `Failed to add task for user: ${user_id}`, null);
    }
});

// 获取文件列表接口
router.get('/files', (req, res) => {
    const sql = 'SELECT * FROM files ORDER BY upload_time DESC';
    db.query(sql, (err, results) => {
        if (err) return res.status(500).send('查询文件列表失败');
        res.json(results);
    });
});
router.get('/getTasksByMonth', async(req, res) => {
    // const { startTime, endTime } = req.query;
    const startTime = new Date(req.query.startTime); // 解析 ISO 时间
    const endTime = new Date(req.query.endTime);

    console.log(startTime)
    const user_id = req.userId
    const result = await apiHelp.checkTasksByMonth(user_id, startTime, endTime)
    console.log(result)
    res.success(StatusCodes.OK, `Task added for user: ${user_id}`, result);
});


module.exports = router;