const { mysql } = require('../../mysql'); // 检查路径是否正确

async function checkAllTasksByUserId(user_id) {
    try {
        const [results] = await mysql.query(`
             WITH RECURSIVE 
TaskHierarchy AS (
    -- 基础情况：顶层任务(task_parent_id 为 NULL 的任务）
    SELECT 
        t.task_id, 
        t.task_title, 
        t.task_text_id, 
        t.task_listicle_id, -- 关联清单ID
        t.task_is_keep_on_top, 
        t.task_start_time, 
        t.task_duration, 
        t.task_priority, 
        t.task_is_focused, 
        t.task_is_finished, 
        t.task_parent_id, 
        t.create_user_id,
        t.create_time,
        0 as level  
    FROM task t
    WHERE t.create_user_id = ?
    AND t.task_parent_id IS NULL  
    UNION ALL
    -- 递归情况：查找子任务
    SELECT 
        t.task_id, 
        t.task_title, 
        t.task_text_id,
        t.task_listicle_id,
        t.task_is_keep_on_top, 
        t.task_start_time, 
        t.task_duration, 
        t.task_priority, 
        t.task_is_focused, 
        t.task_is_finished, 
        t.task_parent_id, 
        t.create_user_id,
        t.create_time,
        th.level + 1 as level 
    FROM task t
    INNER JOIN TaskHierarchy th ON t.task_parent_id = th.task_id
),
TagHierarchy AS (
    -- 基础情况：顶层标签(tag_parent_id 为 NULL 的标签）
    SELECT 
        tg.tag_id, 
        tg.tag_name, 
        tg.tag_color, 
        tg.tag_parent_id, 
        tg.create_time,
        0 as level
    FROM tag tg
    WHERE tg.tag_user_id = ?
    UNION ALL
    -- 递归情况：查找父标签
    SELECT 
        tg.tag_id, 
        tg.tag_name, 
        tg.tag_color, 
        tg.tag_parent_id, 
        tg.create_time,
        th.level + 1 as level
    FROM tag tg
    INNER JOIN TagHierarchy th ON tg.tag_id = th.tag_parent_id
),
ListicleHierarchy AS (
    -- 基础情况：顶层清单(listicle_parent_id 为 NULL 的清单）
    SELECT 
        l.listicle_id, 
        l.listicle_parent_id, 
        l.listicle_icon, 
        l.listicle_title, 
        l.listicle_user_id,
        l.create_time,
        0 as level
    FROM listicle l
    WHERE l.listicle_user_id = ?
    UNION ALL
    -- 递归情况：查找父清单
    SELECT 
        l.listicle_id, 
        l.listicle_parent_id, 
        l.listicle_icon, 
        l.listicle_title, 
        l.listicle_user_id,
        l.create_time,
        lh.level + 1 as level
    FROM listicle l
    INNER JOIN ListicleHierarchy lh ON l.listicle_id = lh.listicle_parent_id
)
SELECT 
    th.task_id, 
    th.task_title, 
    th.task_text_id, 
    th.task_is_keep_on_top, 
    th.task_start_time, 
    th.task_duration, 
    th.task_priority, 
    th.task_is_focused, 
    th.task_is_finished, 
    th.task_parent_id, 
    th.create_user_id,
    th.create_time,
    th.level,
    -- 聚合 notes 数据
    COALESCE(CONCAT('[', GROUP_CONCAT(
        DISTINCT JSON_OBJECT(
            'note_id', n.note_id, 
            'note_title', n.note_title, 
            'create_time', n.create_time
        )
        ORDER BY n.create_time ASC
    ), ']'), '[]') as notes,
    -- 聚合 tags 数据，包括父标签
    COALESCE(CONCAT('[', GROUP_CONCAT(
        DISTINCT JSON_OBJECT(
            'tag_id', tg.tag_id,
            'tag_name', tg.tag_name,
            'tag_color', tg.tag_color,
            'parent_tag_id', tg.tag_parent_id
        )
        ORDER BY tg.tag_name ASC
    ), ']'), '[]') as tags,
    -- 聚合 listicle 数据，包括父清单
    COALESCE(CONCAT('[', GROUP_CONCAT(
        DISTINCT JSON_OBJECT(
            'listicle_id', lh.listicle_id,
            'listicle_title', lh.listicle_title,
            'listicle_icon', lh.listicle_icon,
            'parent_listicle_id', lh.listicle_parent_id
        )
        ORDER BY lh.create_time ASC
    ), ']'), '[]') as listicles
FROM TaskHierarchy th
LEFT JOIN note n ON th.task_id = n.note_task_id
LEFT JOIN tag_task tt ON th.task_id = tt.tag_task_task_id
LEFT JOIN TagHierarchy tg ON tt.tag_task_tag_id = tg.tag_id
LEFT JOIN ListicleHierarchy lh ON th.task_listicle_id = lh.listicle_id
GROUP BY 
    th.task_id, 
    th.task_title,
    th.task_text_id,
    th.task_is_keep_on_top, 
    th.task_start_time, 
    th.task_duration, 
    th.task_priority, 
    th.task_is_focused, 
    th.task_is_finished, 
    th.task_parent_id, 
    th.create_user_id,
    th.create_time,
    th.level
ORDER BY th.level ASC, th.create_time ASC
        `, [user_id, user_id, user_id]);

        return results; // 返回查询结果
    } catch (error) {
        console.error('Error checking tasks by user_id:', error);
        throw error; // 抛出错误让调用者处理
    }
}
async function checkTasksByMonth(user_id, statTime, endTime) {
    try {
        const [results] = await mysql.query(`
            WITH RECURSIVE
    TaskHierarchy AS (
        -- 基础情况：顶层任务 (task_parent_id 为 NULL 的任务）
        SELECT
            t.task_id,
            t.task_title,
            t.task_text_id,
            t.task_listicle_id,
            t.task_is_keep_on_top,
            t.task_start_time,
            t.task_duration,
            t.task_priority,
            t.task_is_focused,
            t.task_is_finished,
            t.task_parent_id,
            t.create_user_id,
            t.create_time,
            0 as level
        FROM task t
        WHERE
            t.create_user_id = ?
            AND t.task_parent_id IS NULL
            AND t.task_start_time BETWEEN ? AND ? -- 按月份过滤
        UNION ALL
        -- 递归情况：查找子任务
        SELECT
            t.task_id,
            t.task_title,
            t.task_text_id,
            t.task_listicle_id,
            t.task_is_keep_on_top,
            t.task_start_time,
            t.task_duration,
            t.task_priority,
            t.task_is_focused,
            t.task_is_finished,
            t.task_parent_id,
            t.create_user_id,
            t.create_time,
            th.level + 1 as level
        FROM task t
            INNER JOIN TaskHierarchy th ON t.task_parent_id = th.task_id
        WHERE
            t.task_start_time BETWEEN ? AND ? -- 子任务也按月份过滤
    ),
    TagHierarchy AS (
        -- 基础情况：顶层标签(tag_parent_id 为 NULL 的标签）
        SELECT tg.tag_id, tg.tag_name, tg.tag_color, tg.tag_parent_id, tg.create_time, 0 as level
        FROM tag tg
        WHERE
            tg.tag_user_id = ?
        UNION ALL
        -- 递归情况：查找父标签
        SELECT tg.tag_id, tg.tag_name, tg.tag_color, tg.tag_parent_id, tg.create_time, th.level + 1 as level
        FROM tag tg
            INNER JOIN TagHierarchy th ON tg.tag_id = th.tag_parent_id
    ),
    ListicleHierarchy AS (
        -- 基础情况：顶层清单(listicle_parent_id 为 NULL 的清单）
        SELECT l.listicle_id, l.listicle_parent_id, l.listicle_icon, l.listicle_title, l.listicle_user_id, l.create_time, 0 as level
        FROM listicle l
        WHERE
            l.listicle_user_id = ?
        UNION ALL
        -- 递归情况：查找父清单
        SELECT l.listicle_id, l.listicle_parent_id, l.listicle_icon, l.listicle_title, l.listicle_user_id, l.create_time, lh.level + 1 as level
        FROM
            listicle l
            INNER JOIN ListicleHierarchy lh ON l.listicle_id = lh.listicle_parent_id
    )
SELECT
    th.task_id,
    th.task_title,
    th.task_text_id,
    th.task_is_keep_on_top,
    th.task_start_time,
    th.task_duration,
    th.task_priority,
    th.task_is_focused,
    th.task_is_finished,
    th.task_parent_id,
    th.create_user_id,
    th.create_time,
    th.level,
    -- 聚合 notes 数据
    COALESCE(
        CONCAT(
            '[',
            GROUP_CONCAT(
                DISTINCT JSON_OBJECT(
                    'note_id',
                    n.note_id,
                    'note_title',
                    n.note_title,
                    'create_time',
                    n.create_time
                )
                ORDER BY n.create_time ASC
            ),
            ']'
        ),
        '[]'
    ) as notes,
    -- 聚合 tags 数据，包括父标签
    COALESCE(
        CONCAT(
            '[',
            GROUP_CONCAT(
                DISTINCT JSON_OBJECT(
                    'tag_id',
                    tg.tag_id,
                    'tag_name',
                    tg.tag_name,
                    'tag_color',
                    tg.tag_color,
                    'parent_tag_id',
                    tg.tag_parent_id
                )
                ORDER BY tg.tag_name ASC
            ),
            ']'
        ),
        '[]'
    ) as tags,
    -- 聚合 listicle 数据，包括父清单
    COALESCE(
        CONCAT(
            '[',
            GROUP_CONCAT(
                DISTINCT JSON_OBJECT(
                    'listicle_id',
                    lh.listicle_id,
                    'listicle_title',
                    lh.listicle_title,
                    'listicle_icon',
                    lh.listicle_icon,
                    'parent_listicle_id',
                    lh.listicle_parent_id
                )
                ORDER BY lh.create_time ASC
            ),
            ']'
        ),
        '[]'
    ) as listicles
FROM
    TaskHierarchy th
    LEFT JOIN note n ON th.task_id = n.note_task_id
    LEFT JOIN tag_task tt ON th.task_id = tt.tag_task_task_id
    LEFT JOIN TagHierarchy tg ON tt.tag_task_tag_id = tg.tag_id
    LEFT JOIN ListicleHierarchy lh ON th.task_listicle_id = lh.listicle_id
GROUP BY
    th.task_id,
    th.task_title,
    th.task_text_id,
    th.task_is_keep_on_top,
    th.task_start_time,
    th.task_duration,
    th.task_priority,
    th.task_is_focused,
    th.task_is_finished,
    th.task_parent_id,
    th.create_user_id,
    th.create_time,
    th.level
ORDER BY th.level ASC, th.create_time ASC
LIMIT 10 OFFSET 1 `, [user_id, statTime, endTime, statTime, endTime, user_id, user_id]);
        return results; // 返回查询结果
    } catch (error) {
        console.error('Error checking tasks by user_id:', error);
        throw error; // 抛出错误让调用者处理
    }
}

// async function checkAllTasksByUserId(user_id) {
//     try {
//         const [results] = await mysql.query(`
//       WITH RECURSIVE TaskHierarchy AS (
//         SELECT 
//           t.task_id, 
//           t.task_title, 
//           t.task_start_time, 
//           t.task_duration, 
//           t.task_priority, 
//           t.task_is_focused, 
//           t.task_is_finished, 
//           t.task_parent_id, 
//           t.create_user_id,
//           t.create_time,
//           0 as level  
//         FROM task t
//         WHERE t.create_user_id = ? 
//         AND t.task_parent_id IS NULL  
//         UNION ALL
//         SELECT 
//           t.task_id, 
//           t.task_title, 
//           t.task_start_time, 
//           t.task_duration, 
//           t.task_priority, 
//           t.task_is_focused, 
//           t.task_is_finished, 
//           t.task_parent_id, 
//           t.create_user_id,
//           t.create_time,
//           th.level + 1 as level 
//         FROM task t
//         INNER JOIN TaskHierarchy th ON t.task_parent_id = th.task_id
//       )
//       SELECT * 
//       FROM TaskHierarchy
//       ORDER BY level ASC, create_time ASC
//     `, [user_id]);

//         return results; // 返回查询结果
//     } catch (error) {
//         console.error('Error checking tasks by user_id:', error);
//         throw error; // 抛出错误让调用者处理
//     }
// }

// async function checkAllTasksByUserId(user_id) {
//     const [results] = await mysql.query('SELECT * from `task`  WHERE create_user_id=?', [user_id]);
//     return results
// }

// async function checkTaskByTaskId(task_id) {
//     const [results] = await mysql.query(
//         `SELECT 
//     t.task_id,
//     t.task_title,
//     t.task_start_time,
//     t.task_duration,
//     t.task_priority,
//     t.task_is_focused,
//     t.task_is_finished,
//     t.task_parent_id,
//     t.create_user_id,
//     t.create_time AS task_create_time, 
//     -- 聚合notes
//     CONCAT(
//         '[', 
//         IFNULL(GROUP_CONCAT(
//             CONCAT(
//                 '{"note_id":"', n.note_id, '", ',
//                 '"note_title":"', n.note_title, '"}'
//             ) 
//             ORDER BY n.create_time
//             SEPARATOR ','
//         ), ''), -- 如果没有note，返回空字符串
//         ']'
//     ) AS notes,

//     -- 聚合子任务
//     CONCAT(
//         '[', 
//         IFNULL(GROUP_CONCAT(
//             DISTINCT CONCAT(
//                 '{"task_id":"', ct.task_id, '", ',
//                 '"task_title":"', ct.task_title, '"}'
//             ) ORDER BY ct.create_time
//             SEPARATOR ','
//         ), ''), -- 如果没有子任务，返回空字符串
//         ']'
//     ) AS children

// FROM 
//     task t
// -- 左连接note表
// LEFT JOIN 
//     note n ON t.task_id = n.note_task_id
// -- 左连接子任务
// LEFT JOIN 
//     task ct ON t.task_id = ct.task_parent_id
// WHERE 
//     t.task_id = ?
// GROUP BY 
//     t.task_id;

// `, [task_id]
//     );
//     return results;
// }
async function updateTaskTitleByTaskId(user_id, task_id, task_title) {
    const sql = `
    UPDATE task
    SET task_title = ?
    WHERE task_id = ?
    AND create_user_id = ?;
  `;
    try {
        const result = await mysql.query(sql, [task_title, task_id, user_id])
        return result
    } catch (error) {
        console.log(error)

    }

}


module.exports = {
    checkAllTasksByUserId,
    updateTaskTitleByTaskId,
    // checkTaskByTaskId, //获取单个任务//包括note
    checkTasksByMonth,

};