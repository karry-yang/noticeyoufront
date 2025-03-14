const { query } = require('express');
const { mysql } = require('../../mysql');
const snowflake = require('../../sonwFlakeIdServer/sonwFlakeid')


// 返回数据{ success: false, message: 200,results:results };
// 200:成功
// 300:失败
// 400：权限不足
// 500：错误运行
async function checkAllHobitByUserId(user_id) {
    const [results] = await mysql.query(`
    SELECT 
        h.hobit_id,
        h.hobit_title,
        h.hobit_checkin_type,
        h.hobit_special_days,
        h.hobit_interval_days,
        h.hobit_duration,
        h.create_time AS hobit_create_time,
        c.checkin_id,
        c.checkin_next_checkin_time,
         COUNT(c.checkin_id) AS total_checkins,
        c.checkin_last_checkin_time
    FROM 
        hobit h
    LEFT JOIN 
        checkin c ON h.hobit_id = c.checkin_hobit_id
    WHERE 
        h.hobit_user_id = ?
    `, [user_id]);

    return results;
}
async function checkHobitsByHobitId(hobit_id) {
    const [results] = await mysql.query(`
        SELECT 
           h.hobit_id,
            h.hobit_title,
            h.hobit_checkin_type,
            h.hobit_weekly_days,
            h.hobit_monthly_days,
            h.hobit_interval_days,
            h.hobit_duration,
            h.bobit_notice_time,
            h.hobit_allow_early_checkin,
            h.hobit_is_show_daily_log,
            h.create_time,
            COUNT(c.checkin_id) AS total_checkins, 
            COUNT(CASE WHEN MONTH(c.checkin_last_checkin_time) = MONTH(CURDATE()) 
                       AND YEAR(c.checkin_last_checkin_time) = YEAR(CURDATE()) 
                       THEN 1 END) AS monthly_checkins,  -- 月打卡数
            -- 计算本月应该打卡的总数
            CASE 
                WHEN h.hobit_checkin_type = 'daily' THEN DAY(LAST_DAY(CURDATE())) -- 本月天数
                WHEN h.hobit_checkin_type = 'weekly' THEN 
                    CASE 
                        WHEN DAY(CURDATE()) <= 7 THEN 1
                        ELSE FLOOR(DAY(LAST_DAY(CURDATE())) / 7) + (IF(DAY(LAST_DAY(CURDATE())) % 7 > 0, 1, 0)) -- 计算本月的周数
                    END
                WHEN h.hobit_checkin_type = 'monthly' THEN 1
                WHEN h.hobit_checkin_type = 'interval_days' THEN 
                    CASE 
                        WHEN h.hobit_interval_days > 0 THEN 
                            FLOOR(DAY(LAST_DAY(CURDATE())) / h.hobit_interval_days) 
                        ELSE 0 
                    END
                ELSE 0 
            END AS expected_monthly_checkins,  -- 本月应该打卡总数
            -- 计算月完成率
            (COUNT(CASE WHEN MONTH(c.checkin_last_checkin_time) = MONTH(CURDATE()) 
                         AND YEAR(c.checkin_last_checkin_time) = YEAR(CURDATE()) 
                         THEN 1 END) 
            / CASE 
                WHEN h.hobit_checkin_type = 'daily' THEN DAY(LAST_DAY(CURDATE()))
                WHEN h.hobit_checkin_type = 'weekly' THEN 
                    CASE 
                        WHEN DAY(CURDATE()) <= 7 THEN 1
                        ELSE FLOOR(DAY(LAST_DAY(CURDATE())) / 7) + (IF(DAY(LAST_DAY(CURDATE())) % 7 > 0, 1, 0)) 
                    END
                WHEN h.hobit_checkin_type = 'monthly' THEN 1
                WHEN h.hobit_checkin_type = 'interval_days' THEN 
                    CASE 
                        WHEN h.hobit_interval_days > 0 THEN 
                            FLOOR(DAY(LAST_DAY(CURDATE())) / h.hobit_interval_days) 
                        ELSE 0 
                    END
                ELSE 0 
            END) * 100 AS monthly_completion_rate,  -- 月完成率
            IFNULL(SUM(
                CASE 
                    WHEN c.checkin_last_checkin_time IS NOT NULL 
                    AND (DATEDIFF(CURDATE(), c.checkin_last_checkin_time) <= IFNULL(h.hobit_interval_days, 1)) 
                    THEN 1 
                    ELSE 0 
                END
            ), 0) AS continuous_checkin_count,  -- 连续打卡次数
            -- 将所有打卡日期合并为 JSON 格式的字符串
            IFNULL(CONCAT('[', GROUP_CONCAT(DISTINCT DATE_FORMAT(c.checkin_checkin_time , '"%Y-%m-%d"') ORDER BY c.checkin_checkin_time  ASC), ']'), '[]') AS check_in_dates
        FROM 
            hobit h
        LEFT JOIN checkin c ON h.hobit_id = c.checkin_hobit_id
        WHERE 
            h.hobit_id = ?
        GROUP BY 
            h.hobit_id, h.hobit_title, h.hobit_checkin_type, h.hobit_duration;
    `, [hobit_id]);

    return results;
}

// 单独某天 hobit 数据
// async function getAllHobitsBySelectedDate(user_id, selectedDate) {
//     const sql = `SELECT 
//         h.hobit_id,
//         h.hobit_title,
//         h.hobit_checkin_type,
//         h.hobit_weekly_days,
//         h.hobit_monthly_days,
//         h.hobit_interval_days,
//         h.hobit_duration,
//         h.bobit_notice_time,
//         h.hobit_allow_early_checkin,
//         h.hobit_is_show_daily_log,
//         h.create_time,
//     CASE
//         WHEN h.hobit_checkin_type = 'daily' THEN 1
//         WHEN h.hobit_checkin_type = 'weekly' AND FIND_IN_SET(WEEKDAY(?)+1, h.hobit_weekly_days) > 0 THEN 1
//         WHEN h.hobit_checkin_type = 'monthly' AND FIND_IN_SET(DAY(?), h.hobit_monthly_days) > 0 THEN 1
//         WHEN h.hobit_checkin_type = 'interval_days' AND MOD(DATEDIFF(?, h.create_time), h.hobit_interval_days) = 0 THEN 1
//         ELSE 0
//     END AS should_checkin
// FROM hobit h
// WHERE 
//     h.hobit_user_id = ?
//     AND ? >= h.create_time 
//     AND ? <= DATE_ADD(h.create_time, INTERVAL h.hobit_duration DAY)
// HAVING should_checkin = 1;

//     `;


//     const results = await mysql.query(sql, [
//         selectedDate, // 适用于 weekly
//         selectedDate, // 适用于 monthly
//         selectedDate, // 用于 interval_days 的比较
//         user_id, // 用户 ID
//         selectedDate, // 用于创建时间的比较
//         selectedDate // 用于 interval_days 的比较
//     ]);

//     return results;
// }

async function getAllHobitsBySelectedDate(userId, startTime, endTime) {
    const sql = `
    WITH HobitInfo AS (
        SELECT
            h.hobit_id,
            h.hobit_title,
            h.hobit_checkin_type,
            h.hobit_weekly_days,
            h.hobit_monthly_days,
            h.hobit_interval_days,
            h.hobit_duration,
            h.bobit_notice_time,
            h.hobit_allow_early_checkin,
            h.hobit_is_show_daily_log,
            h.create_time
        FROM hobit h
        WHERE h.hobit_user_id = ?
        -- 使用 startTime 和 endTime 来判断习惯的持续时间
        AND DATE(?) BETWEEN DATE(h.create_time) AND DATE_ADD(h.create_time, INTERVAL h.hobit_duration DAY)
        AND DATE(?) <= DATE_ADD(h.create_time, INTERVAL h.hobit_duration DAY)  -- 加入 endTime 限制
    ),
    CheckinInfo AS (
        SELECT
            c.checkin_hobit_id,
            MAX(c.checkin_checkin_time) AS last_checkin_time, -- 最近打卡时间
            COUNT(c.checkin_id) AS total_checkins,             -- 总打卡次数
            -- 计算连续打卡次数，按规则计算是否连续
            SUM(
                CASE
                    WHEN h.hobit_checkin_type = 'daily' THEN -- 每日打卡的连续打卡逻辑
                        CASE
                            WHEN DATE(c.checkin_checkin_time) = DATE(DATE_SUB(?, INTERVAL 1 DAY)) -- 基于 startTime
                            THEN 1 ELSE 0 END
                    WHEN h.hobit_checkin_type = 'weekly' THEN -- 每周打卡逻辑
                        CASE
                            WHEN FIND_IN_SET(DAYOFWEEK(?), h.hobit_weekly_days) -- 基于 startTime
                            THEN 1 ELSE 0 END
                    WHEN h.hobit_checkin_type = 'monthly' THEN -- 每月打卡逻辑
                        CASE
                            WHEN FIND_IN_SET(DAYOFMONTH(?), h.hobit_monthly_days) -- 基于 startTime
                            THEN 1 ELSE 0 END
                    WHEN h.hobit_checkin_type = 'interval_days' THEN -- 间隔打卡
                        CASE
                            WHEN DATEDIFF(?, c.checkin_checkin_time) <= h.hobit_interval_days -- 基于 startTime
                            THEN 1 ELSE 0 END
                    ELSE 0
                END
            ) AS consecutive_checkins -- 计算连续打卡次数
        FROM checkin c
        JOIN HobitInfo h ON c.checkin_hobit_id = h.hobit_id
        GROUP BY c.checkin_hobit_id
    )
    SELECT 
        h.hobit_id,
        h.hobit_title,
        h.hobit_checkin_type,
        h.hobit_weekly_days,
        h.hobit_monthly_days,
        h.hobit_interval_days,
        h.hobit_duration,
        h.bobit_notice_time,
        h.hobit_allow_early_checkin,
        h.hobit_is_show_daily_log,
        h.create_time,
        IFNULL(c.total_checkins, 0) AS total_checkins,         -- 总打卡次数
        IFNULL(c.consecutive_checkins, 0) AS continuous_checkin_count -- 连续打卡次数
    FROM HobitInfo h
    LEFT JOIN CheckinInfo c ON h.hobit_id = c.checkin_hobit_id;
    `;

    const [results] = await mysql.query(sql, [userId, startTime, endTime, startTime, startTime, startTime, startTime]);
    console.log("checkAllReductionHobitsByUserId:", results);
    return results;
}




//计算七天打卡的总数/打卡数/每日完成率
async function checkSevenDaysHobitsCompletionPercentage(user_id, startDate, endDate) {
    const sql = `WITH RECURSIVE DateRange AS (
    -- 生成指定日期范围的日期
    SELECT ? AS checkin_date  -- 起始日期
    UNION ALL
    SELECT DATE_ADD(checkin_date, INTERVAL 1 DAY)
    FROM DateRange
    WHERE checkin_date < ?  
),
HobitStats AS (
    SELECT
        d.checkin_date,
        
        -- 计算某天应打卡的 hobit 数量
        (SELECT COUNT(*)
         FROM hobit h
         WHERE h.hobit_user_id = ?  -- 过滤条件: 用户ID
         AND DATE(d.checkin_date) BETWEEN DATE(h.create_time) AND DATE_ADD(h.create_time, INTERVAL h.hobit_duration DAY)
         AND (
            -- 每日打卡
            h.hobit_checkin_type = 'daily'
            
            -- 每周打卡: 判断当天是否是设置的周几之一
            OR (
                h.hobit_checkin_type = 'weekly'
                AND FIND_IN_SET(DAYOFWEEK(d.checkin_date) - 1, h.hobit_weekly_days)  -- DAYOFWEEK 返回周几(1为周日)，所以要减1
            )
            
            -- 每月打卡: 判断当天是否是设置的几号之一
            OR (
                h.hobit_checkin_type = 'monthly'
                AND FIND_IN_SET(DAYOFMONTH(d.checkin_date), h.hobit_monthly_days)
            )
            
            -- 间隔打卡: 通过间隔天数计算
            OR (
                h.hobit_checkin_type = 'interval_days'
                AND MOD(DATEDIFF(d.checkin_date, h.create_time), h.hobit_interval_days) = 0
            )
         )
        ) AS total_hobit,

        -- 已打卡的 hobit 数量
        (SELECT COUNT(DISTINCT c.checkin_hobit_id)
         FROM checkin c
         JOIN hobit h ON c.checkin_hobit_id = h.hobit_id
         WHERE h.hobit_user_id = ?  -- 过滤条件: 用户ID
         AND DATE(c.checkin_checkin_time) = d.checkin_date
        ) AS checked_in_hobit
    FROM DateRange d
)

SELECT
    checkin_date,
    total_hobit,
    checked_in_hobit,
    CASE 
        WHEN total_hobit = 0 THEN 0
        ELSE checked_in_hobit / total_hobit
    END AS checkin_rate
FROM HobitStats
WHERE checkin_date BETWEEN ? AND ?;

`;

    const [results] = await mysql.query(sql, [startDate, endDate, user_id, user_id, startDate, endDate]);

    console.log('Seven Days Hobit Completion Percentage:', results); // 调试输出

    return results;
}


async function checkAllReductionHobitsByUserId(userId) {
    const sql = `WITH HobitInfo AS (
    SELECT
        h.hobit_id,
        h.hobit_title,
        h.hobit_checkin_type,
        h.hobit_weekly_days,
        h.hobit_monthly_days,
        h.hobit_interval_days,
        h.hobit_duration,
        h.bobit_notice_time,
        h.hobit_allow_early_checkin,
        h.hobit_is_show_daily_log,
        h.create_time
    FROM hobit h
    WHERE h.hobit_user_id = ?
    AND DATE(CURRENT_DATE()) BETWEEN DATE(h.create_time) AND DATE_ADD(h.create_time, INTERVAL h.hobit_duration DAY)
),
CheckinInfo AS (
    SELECT
        c.checkin_hobit_id,
        MAX(c.checkin_checkin_time) AS last_checkin_time, -- 最近打卡时间
        COUNT(c.checkin_id) AS total_checkins,             -- 总打卡次数
        -- 计算连续打卡次数，按规则计算是否连续
        SUM(
            CASE
                WHEN h.hobit_checkin_type = 'daily' THEN -- 每日打卡的连续打卡逻辑
                    CASE
                        WHEN DATE(c.checkin_checkin_time) = DATE(DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY))
                        THEN 1 ELSE 0 END
                WHEN h.hobit_checkin_type = 'weekly' THEN -- 每周打卡逻辑
                    CASE
                        WHEN FIND_IN_SET(DAYOFWEEK(CURRENT_DATE()), h.hobit_weekly_days)
                        THEN 1 ELSE 0 END
                WHEN h.hobit_checkin_type = 'monthly' THEN -- 每月打卡逻辑
                    CASE
                        WHEN FIND_IN_SET(DAYOFMONTH(CURRENT_DATE()), h.hobit_monthly_days)
                        THEN 1 ELSE 0 END
                WHEN h.hobit_checkin_type = 'interval_days' THEN -- 间隔打卡
                    CASE
                        WHEN DATEDIFF(CURRENT_DATE(), c.checkin_checkin_time) <= h.hobit_interval_days
                        THEN 1 ELSE 0 END
                ELSE 0
            END
        ) AS consecutive_checkins -- 计算连续打卡次数
    FROM checkin c
    JOIN HobitInfo h ON c.checkin_hobit_id = h.hobit_id
    GROUP BY c.checkin_hobit_id
)
SELECT 
    h.hobit_id,
    h.hobit_title,
    h.hobit_checkin_type,
    h.hobit_weekly_days,
    h.hobit_monthly_days,
    h.hobit_interval_days,
    h.hobit_duration,
    h.bobit_notice_time,
    h.hobit_allow_early_checkin,
    h.hobit_is_show_daily_log,
    h.create_time,
    --IFNULL(c.last_checkin_time, NULL) AS last_checkin_time,
    IFNULL(c.total_checkins, 0) AS total_checkins,         -- 总打卡次数
    IFNULL(c.consecutive_checkins, 0) AS continuous_checkin_count -- 连续打卡次数
FROM HobitInfo h
LEFT JOIN CheckinInfo c ON h.hobit_id = c.checkin_hobit_id;
`
    const [results] = await mysql.query(sql, [userId]);
    console.log("checkAllReductionHobitsByUserId:", results)
    return results

}

const calculateNextCheckinTime = (hobit_checkin_type, lastCheckinTime, hobit_interval_days, hobit_weekly_days, hobit_monthly_days, allow_early_checkin) => {
    const currentTime = new Date(); // 当前时间
    let nextCheckinTime;

    // 如果这是第一次打卡或没有提前打卡
    const isFirstTime = !lastCheckinTime;

    if (isFirstTime) {
        // 第一次打卡，根据当前时间计算最近的下次打卡时间
        nextCheckinTime = getClosestCheckinTime(currentTime, hobit_checkin_type, hobit_interval_days, hobit_weekly_days, hobit_monthly_days);
    } else {
        // 非第一次打卡，先计算出最接近的下次打卡时间
        const closestNextCheckinTime = getClosestCheckinTime(currentTime, hobit_checkin_type, hobit_interval_days, hobit_weekly_days, hobit_monthly_days);

        if (allow_early_checkin === '1') {
            // 如果允许提前打卡，计算的是距离当前时间的第二个下次打卡时间
            const secondClosestCheckinTime = getClosestCheckinTime(closestNextCheckinTime, hobit_checkin_type, hobit_interval_days, hobit_weekly_days, hobit_monthly_days);
            nextCheckinTime = secondClosestCheckinTime;
        } else {
            // 不允许提前打卡，取当前时间之后最接近的时间
            nextCheckinTime = closestNextCheckinTime;
        }
    }

    return nextCheckinTime;
};

// 获取最接近的下次打卡时间
function getClosestCheckinTime(currentTime, hobit_checkin_type, hobit_interval_days, hobit_weekly_days, hobit_monthly_days) {
    let nextCheckinTime;

    switch (hobit_checkin_type) {
        case 'daily':
            nextCheckinTime = new Date(currentTime.setDate(currentTime.getDate() + 1)); // 每天打卡，直接加一天
            break;
        case 'weekly':
            {
                const weeklyDays = hobit_weekly_days.split(',').map(Number); // 每周需要打卡的天数
                const today = currentTime.getDay(); // 获取今天是星期几
                // 找到下一个符合条件的星期几
                const nextDay = weeklyDays.find(day => day > today) || weeklyDays[0];
                const daysUntilNextCheckin = (nextDay + 7 - today) % 7 || 7; // 计算距离下次打卡的天数
                nextCheckinTime = new Date(currentTime.setDate(currentTime.getDate() + daysUntilNextCheckin));
                break;
            }
        case 'monthly':
            {
                const monthlyDays = hobit_monthly_days.split(',').map(Number); // 每月需要打卡的天数
                const today = currentTime.getDate(); // 获取今天是几号
                const nextDay = monthlyDays.find(day => day > today) || monthlyDays[0]; // 找到下一个符合条件的日子
                nextCheckinTime = new Date(currentTime.setMonth(currentTime.getMonth() + (nextDay < today ? 1 : 0), nextDay)); // 如果日期已经过了，就计算下个月
                break;
            }
        case 'interval_days':
            nextCheckinTime = new Date(currentTime.setDate(currentTime.getDate() + hobit_interval_days)); // 按间隔天数打卡
            break;
        default:
            throw new Error('Unknown hobit_checkin_type');
    }

    return nextCheckinTime;
}

async function punchIn(user_id, hobit_id) {
    try {
        await mysql.beginTransaction();

        // 查询 hobit 信息
        const [hobitInfo] = await mysql.execute(`
            SELECT 
                h.hobit_checkin_type,
                h.hobit_weekly_days,
                h.hobit_monthly_days,
                h.hobit_interval_days,
                h.hobit_allow_early_checkin,
                h.create_time
            FROM hobit h
            WHERE h.hobit_id = ?
            AND h.hobit_user_id = ?;
        `, [hobit_id, user_id]);

        if (hobitInfo.length === 0) {
            throw new Error('Habit not found or user does not have permission');
        }
        const hobit = hobitInfo[0];

        // 查询最近的一次打卡记录
        const [lastCheckin] = await mysql.execute(`
            SELECT 
                checkin_id, checkin_checkin_time, checkin_next_checkin_time
            FROM checkin
            WHERE checkin_hobit_id = ?
            ORDER BY checkin_checkin_time DESC
            LIMIT 1;
        `, [hobit_id]);

        let canCheckin = false;
        const now = new Date();
        //上次打卡时间
        let lastCheckinTime = new Date(lastCheckin[0].checkin_checkin_time);
        //下次打卡时间
        let nextCheckinTime = new Date(lastCheckin[0].checkin_next_checkin_time);
        const isSameDay = now.getFullYear() === lastCheckinTime.getFullYear() && now.getMonth() === lastCheckinTime.getMonth() && now.getDate() === lastCheckinTime.getDate()
        console.log("isSameDay", isSameDay)
        if (isSameDay) {
            throw new Error('已经打卡，不可重复');
        }
        if (lastCheckin.length > 0) {
            // 如果允许提前打卡，当前时间只需要超过上次记录的 checkin_checkin_time 就可以打卡
            if (hobit.hobit_allow_early_checkin === '1') {
                canCheckin = now >= lastCheckinTime;
            } else {
                // 不允许提前打卡的情况下，必须严格匹配下次打卡时间
                canCheckin = now >= nextCheckinTime && now.toDateString() === nextCheckinTime.toDateString();
            }
        } else {
            // 没有打卡记录，允许打卡
            canCheckin = true;
        }
        if (!canCheckin) {
            throw new Error('Not eligible for check-in at this time');
        }

        // 计算下次打卡时间
        nextCheckinTime = calculateNextCheckinTime(
            hobit.hobit_checkin_type,
            lastCheckinTime,
            hobit.hobit_interval_days,
            hobit.hobit_weekly_days,
            hobit.hobit_monthly_days,
            hobit.hobit_allow_early_checkin
        );

        // 插入打卡记录
        const checkinId = snowflake.generate(); // 生成唯一ID的函数
        await mysql.execute(`
            INSERT INTO checkin (
                checkin_id,
                checkin_hobit_id,
                checkin_checkin_time,
                checkin_last_checkin_time,
                checkin_next_checkin_time
            )
            VALUES (?, ?, NOW(), ?, ?);
        `, [checkinId, hobit_id, lastCheckinTime, nextCheckinTime]);

        await mysql.commit();
        return checkinId;
    } catch (error) {
        await mysql.rollback();
        console.error('Check-in failed:', error);
        return null;
    }
}



async function checkAllCheckinLogsByCurrentMonth(hobit_id, startOfMonthStr, endOfMonthStr) {
    const [results] = await mysql.query(`  SELECT cl.*
        FROM checkin_log cl
        JOIN checkin c ON cl.checkin_log_checkin_id = c.checkin_id
        WHERE c.checkin_hobit_id = ?
        AND cl.create_time BETWEEN ? AND ?`, [hobit_id, startOfMonthStr, endOfMonthStr]);
    return results

}
async function insertCheckinLogByCheckinId(checkin_id, chechin_log_icon, checkin_log_text) {
    const checkin_log_id = snowflake.generate();
    const result = await mysql.query(`
    INSERT INTO checkin_log (checkin_log_id, chechin_log_icon, checkin_log_text, checkin_log_checkin_id)
    VALUES (?, ?, ?, ?)
  `, [checkin_log_id, chechin_log_icon, checkin_log_text, checkin_id, ])
    return result;

}




module.exports = {
    checkAllHobitByUserId,
    checkHobitsByHobitId,
    getAllHobitsBySelectedDate,
    checkSevenDaysHobitsCompletionPercentage,
    checkAllReductionHobitsByUserId,
    punchIn,
    checkAllCheckinLogsByCurrentMonth,
    insertCheckinLogByCheckinId
};