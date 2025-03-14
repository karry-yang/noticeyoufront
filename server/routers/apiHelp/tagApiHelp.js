const { mysql } = require('../../mysql');
async function checkAllTagsByUserId(user_id) {
    const [results] = await mysql.query(`WITH RECURSIVE TagHierarchy AS (
        -- 基础查询：选择用户ID对应的顶层标签（没有父标签）
    SELECT 
        t.tag_id,
        t.tag_name,
        t.tag_color,
        t.tag_parent_id,
        t.tag_user_id,
        t.create_time,
        0 AS level
    FROM tag t
    WHERE t.tag_user_id = ? 
    AND t.tag_parent_id IS NULL -- 顶层标签
    UNION ALL
    -- 递归查询：选择父标签的子标签
    SELECT 
        t.tag_id,
        t.tag_name,
        t.tag_color,
        t.tag_parent_id,
        t.tag_user_id,
        t.create_time,
        th.level + 1 AS level
    FROM tag t
    INNER JOIN TagHierarchy th ON t.tag_parent_id = th.tag_id)
SELECT * 
FROM TagHierarchy
ORDER BY level ASC, create_time ASC;`, [user_id]);
    return results
}
module.exports = {
    checkAllTagsByUserId

};