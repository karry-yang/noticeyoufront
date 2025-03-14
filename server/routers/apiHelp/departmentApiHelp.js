const { mysql, getMySqlConnection } = require('../../mysql');

async function checkAllDepartmentsByGroupId(group_id) {
    const sql = "SELECT * FROM `department` Where department_group_id=?"
    const [result] = await mysql.query(sql, [group_id])
    return result
}
async function updateUserDepartmentIdByUserId(department_id, user_id) {
    const sql = "UPDATE user SET user_department_id=?, update_time = NOW()WHERE user_id=?"
    const [result] = await mysql.query(sql, [department_id, user_id])
    return result
}
async function checkDepartmentByDepartmentId(department_id) {
    const sql = "SELECT * FROM `department` Where department_id=?"
    const [result] = await mysql.query(sql, [department_id])
    return result
}
module.exports = {
    checkAllDepartmentsByGroupId, //查询特定的组群id部门
    updateUserDepartmentIdByUserId, //根据用户id修改的用户的部门id
    checkDepartmentByDepartmentId, //更具部门id查询部门信息

};