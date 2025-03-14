const express = require('express');
const router = express.Router(); // 使用 Router 实例
const { use } = require('bcrypt/promises');
const apiHelp = require('../apiHelp/hobitApiHelp')
const StatusCodes = require('../../utils/statusCodes');

require('../../utils/authenticate')
require('util');

// 获取最近七天的打卡完成情况
router.post('/getAllHobitByUserId', async(req, res, next) => {
    const userId = req.userId;
    const date = new Date();
    // 将日期设置为当前日期的最后时间，并考虑时区（假设你在 UTC+8 区域）
    const endDate = new Date(date.getTime()); // 加上8小时，转成北京时间
    endDate.setHours(23, 59, 59, 999); // 设置为当天最后时间
    const startDate = new Date(endDate);
    startDate.setDate(endDate.getDate() - 6); // 计算过去7天的开始日期
    startDate.setHours(0, 0, 0, 0); // 设置7天前的日期为当天0点 00:00:00.000
    // console.log("startDate:", startDate.toISOString());
    // console.log("endDate:", endDate.toISOString());


    try {


        // 计算每一天的完成度和打卡信息
        const sevenDaysHobitCompletionPercentage = await apiHelp.checkSevenDaysHobitsCompletionPercentage(userId, startDate, endDate);
        // 计获取所有还在持续的hobits
        const hobitsList = await apiHelp.checkAllReductionHobitsByUserId(userId);
        const resultDatas = {
            sevenDaysHobitCompletionPercentage: sevenDaysHobitCompletionPercentage,
            hobitsList: hobitsList
        }
        res.success(StatusCodes.SUCCESS, `${userId}--/getAllHobitByUserId--sevenDaysHobitCompletionPercentage--checkAllReductionHobitsByUserId`, resultDatas)
    } catch (error) {

        res.error(StatusCodes.INTERNAL_SERVER_ERROR, `${userId}--/getAllHobitByUserId--sevenDaysHobitCompletionPercentage--checkAllReductionHobitsByUserId`, null)
        next(error)
    }
});

//获取某天的打卡情况
router.post("/getAllHobitByTime", async(req, res, next) => {
    const user_id = req.userId; // 通过查询参数接收 user_id
    const { time } = req.body

    const startDate = new Date(Date.parse(time));
    const endDate = new Date(Date.parse(time));
    endDate.setHours(23, 59, 59, 999);
    startDate.setHours(0, 0, 0, 0);

    try {
        const results = await apiHelp.getAllHobitsBySelectedDate(user_id, startDate, endDate);
        res.success(StatusCodes.SUCCESS, `${user_id}--/getAllHobitByTime--getAllHobitsBySelectedDate`, results)
    } catch (error) {
        res.error(StatusCodes.INTERNAL_SERVER_ERROR, `${user_id}--/getAllHobitByTime--getAllHobitsBySelectedDate`, null)
        next(error)

    }



})
router.post("/getHobitsByHobitId/:id", async(req, res, next) => {
    const user_id = req.userId; // 通过查询参数接收 user_id
    const hobit_id = req.params.id;
    try {
        const results = await apiHelp.checkHobitsByHobitId(hobit_id);
        console.log("getHobitsByHobitId:", results[0])
        res.success(StatusCodes.SUCCESS, `${user_id}--/getAllHobitByUserId--/getHobitsByHobitId/:${user_id}`, results[0])
    } catch (error) {
        res.error(StatusCodes.INTERNAL_SERVER_ERROR, `${user_id}--/getAllHobitByUserId--/getHobitsByHobitId/:${user_id}`, null)
        next(error)

    }



})
router.post("/inserCheckInByHobitId/:hobitId", async(req, res, next) => {
    const user_id = req.userId; // 通过查询参数接收 user_id
    const hobit_id = req.params.hobitId;
    try {
        const result = await apiHelp.punchIn(user_id, hobit_id);
        console.log("result", result)
        if (result) {
            const data = await apiHelp.checkHobitsByHobitId(hobit_id)
            console.log("checkHobitsByHobitId", data)
            const results = {
                currentHobit: data[0],
                checkinId: result
            }
            console.log("checkHobitsByHobitId", data)
            res.success(StatusCodes.SUCCESS, `${user_id}--/inserCheckInByHobitId--punchIn`, results)
        } else {
            res.error(StatusCodes.INTERNAL_SERVER_ERROR, `${user_id}--/inserCheckInByHobitId--punchIn`, null)
        }
    } catch (error) {
        res.error(StatusCodes.INTERNAL_SERVER_ERROR, `${user_id}--/inserCheckInByHobitId--punchIn参数错误`, null)
        next(error)

    }



})

router.post("/getAllCheckinLogsByCurrentMonth", async(req, res, next) => {
    const user_id = req.userId;
    const { currentDate, currentHobitId } = req.body;

    if (!currentDate || !currentHobitId) {
        res.error(StatusCodes.INTERNAL_SERVER_ERROR, `${user_id}--/getAllCheckinLogsByCurrentMonth--参数错误`, null)
    }

    try {
        // 将传入的 currentDate 字符串转换为 Date 对象
        const dateObj = new Date(currentDate);
        if (isNaN(dateObj)) {
            res.error(StatusCodes.INTERNAL_SERVER_ERROR, `${user_id}--/getAllCheckinLogsByCurrentMonth--currentDate参数错误`, null)
        }

        // 获取当前月份的起始和结束日期
        const startOfMonth = new Date(dateObj.getFullYear(), dateObj.getMonth(), 1);
        const endOfMonth = new Date(dateObj.getFullYear(), dateObj.getMonth() + 1, 0);

        // 将日期转换为 MySQL 中的日期格式
        const startOfMonthStr = startOfMonth.toISOString().split("T")[0]; // 格式为 "YYYY-MM-DD"
        const endOfMonthStr = endOfMonth.toISOString().split("T")[0]; // 格式为 "YYYY-MM-DD"

        // 调用函数获取数据
        const results = await apiHelp.checkAllCheckinLogsByCurrentMonth(currentHobitId, startOfMonthStr, endOfMonthStr);
        console.log(results)
        res.success(StatusCodes.SUCCESS, `${user_id}--/getAllCheckinLogsByCurrentMonth--checkAllCheckinLogsByCurrentMonth`, results)
    } catch (error) {
        console.error(error);
        res.error(StatusCodes.INTERNAL_SERVER_ERROR, `${user_id}--/getAllCheckinLogsByCurrentMonth--getAllCheckinLogsByCurrentMonth`, null)
        next(error);
    }
});


router.post("/inserstCheckinDailyLog", async(req, res, next) => {
    const user_id = req.userId; // 通过查询参数接收 user_id
    const { checkin_id, chechin_log_icon, checkin_log_text } = req.body;
    console.log(checkin_id, chechin_log_icon, checkin_log_text)
    if (!checkin_id || !chechin_log_icon || !checkin_log_text) {
        res.error(StatusCodes.INTERNAL_SERVER_ERROR, `${user_id}--/inserstCheckinDailyLog--参数错误`, null)
        return; // 确保在这里结束请求处理
    }
    try {
        const results = await apiHelp.insertCheckinLogByCheckinId(checkin_id, chechin_log_icon, checkin_log_text);
        res.success(StatusCodes.SUCCESS, `${user_id}--/inserstCheckinDailyLog--insertCheckinLogByCheckinId`, results)
    } catch (error) {
        res.error(StatusCodes.INTERNAL_SERVER_ERROR, `${user_id}--/inserstCheckinDailyLog--insertCheckinLogByCheckinId`, null)
        next(error)

    }



})
module.exports = router; // 确保导出的是 router