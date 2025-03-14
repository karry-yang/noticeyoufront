const { mysql } = require('../../mysql');
async function checkAllUserSetting(user_id) {
    const [results] = await mysql.query(`SELECT * FROM setting WHERE setting_user_id=?  `, [user_id]);
    return results
}
async function isInsertedSetting(setting_id, user_id) {
    const [results] = await mysql.query('insert into `setting`(setting_id,setting_user_id) VALUES(?,?)  ', [setting_id, user_id]);
    return results
}
// `setting_id` varchar(255) NOT NULL COMMENT '设置id',
// `setting_user_id` varchar(255) NOT NULL COMMENT '外键-用户id',
// `setting_is_show_calendar` enum('0', '1') DEFAULT '1' COMMENT '是否展示日历部分，默认:1展示',
// `setting_is_show_matrix` enum('0', '1') DEFAULT '1' COMMENT '是否展示四象限部分，默认:1展示',
// `setting_is_show_hobit` enum('0', '1') DEFAULT '1' COMMENT '是否展示习惯部分，默认:1展示',
// `setting_is_show_focus` enum('0', '1') DEFAULT '1' COMMENT '是否展专注部分，默认:1展示',
// `setting_is_daily_notice` enum('0', '1') DEFAULT '1' COMMENT '是否开启每日提醒，默认:1开启提醒',
// `setting_daily_notice_time` enum('0', '1') DEFAULT '1' COMMENT '每日提醒时间，默认:9点',
// `setting_is_Page_notice` enum('0', '1') DEFAULT '1' COMMENT '开启网页提示，默认:1提示',
// `setting_is_email_notice` enum('0', '1') DEFAULT '1' COMMENT '是否开启邮箱提示，默认:1提示',
// `setting_is_show_all_tasks` enum('0', '1') DEFAULT '1' COMMENT '是否展每日任务，默认:1展示',
// `setting_is_show_today_tasks` enum('0', '1') DEFAULT '1' COMMENT '是否展今日任务，默认:1展示',
// `setting_is_show_tomorrow_tasks` enum('0', '1') DEFAULT '1' COMMENT '是否展明日任务，默认:1展示',
// `setting_is_show_week_tasks` enum('0', '1') DEFAULT '1' COMMENT '是否展周任务，默认:1展示',
// `setting_is_show_abstract` enum('0', '1') DEFAULT '1' COMMENT '是否展摘要，默认:1展示',
// `setting_is_show_assigned_meTasks` enum('0', '1') DEFAULT '1' COMMENT '是否展指派给我，默认:1展示',
// `setting_is_show_collecting_box` enum('0', '1') DEFAULT '1' COMMENT '是否展收集箱，默认:1展示',
// `setting_theme_id` varchar(255) DEFAULT 'white' COMMENT '主题',
// `setting_is_show_week_number` enum('0', '1') DEFAULT '1' COMMENT '是否展示周数 默认:1展示',
// `setting_time_format` enum('0', '1') DEFAULT '1' COMMENT '时间格式:默认1为24小时格式',
// `setting_time_start` enum('7', '6', '1') DEFAULT '7' COMMENT '时间格式:默认1为24小时格式',
// `setting_time_zone` enum('0', '1') DEFAULT '0' COMMENT '时区设置',

module.exports = {
    checkAllUserSetting,
    isInsertedSetting,

};