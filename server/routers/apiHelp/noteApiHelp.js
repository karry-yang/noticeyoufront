const { mysql } = require('../../mysql');
async function checkAllNotesByTaskId(task_id) {
    const [results] = await mysql.query('SELECT * FROM `note` WHERE task_detail_id=?', [task_id])
    return results

}
module.exports = {
    checkAllNotesByTaskId

};