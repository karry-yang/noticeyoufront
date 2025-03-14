const { mysql, getMySqlConnection } = require('../../mysql');
async function checkAllGroups() {
    const sql = "SELECT * FROM `group`"
    cont[results] = await mysql.query(sql)
    return results
}
async function checkGroupByGrouId(group_id) {
    const sql = `SELECT 
    group_id, 
    group_name, 
    group_code, 
    group_leader_id
FROM  \`group\` 
WHERE  group_id = ?
`
    const [result] = await mysql.query(sql, [group_id])
    return result
}
async function checkGroupByGroupCode(groupCode) {
    const sql = `SELECT 
    group_id, 
    group_name, 
    group_code, 
    group_leader_id
FROM  \`group\` 
WHERE  group_code = ?
`
    const [result] = await mysql.query(sql, [groupCode])
    return result
}
module.exports = {
    checkAllGroups, //查询所有的组群
    checkGroupByGrouId, //查询特定的组群
    checkGroupByGroupCode, //查询特定组织通过code
};