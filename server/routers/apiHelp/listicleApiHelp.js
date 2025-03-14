const { mysql } = require('../../mysql');
async function checkAllListiclesByUserId(user_id) {
    const results = mysql.query(`WITH RECURSIVE ListicleHierarchy AS (
        -- 基础查询：选择用户ID对应的顶层标签（没有父标签）
    SELECT 
        L.listicle_id,
        L.listicle_parent_id,
        L.listicle_icon, 
        L.listicle_title,
        L.listicle_user_id,
        L.listicle_is_deleted,
        L.create_time,
        0 AS level
    FROM listicle L
    WHERE  L.listicle_user_id = ? 
    AND  L.listicle_parent_id IS NULL -- 顶层标签
    UNION ALL
    -- 递归查询：选择父标签的子标签
    SELECT 
         L.listicle_id,
        L.listicle_parent_id,
        L.listicle_icon, 
        L.listicle_title,
        L.listicle_user_id,
        L.listicle_is_deleted,
        L.create_time,
        lh.level + 1 AS level
    FROM listicle L
    INNER JOIN ListicleHierarchy lh ON L.listicle_parent_id = lh.listicle_id)
SELECT * 
FROM ListicleHierarchy
ORDER BY level ASC, create_time ASC;`, [user_id]);
    return results

}

module.exports = {
    checkAllListiclesByUserId,
    // checkTaskByTaskId, //获取单个任务//包括note

};