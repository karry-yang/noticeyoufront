async function nestedTasks(tasksList) {

    if (tasksList && tasksList !== null && tasksList.length > 0) {
        const taskMap = {};

        // 将任务存入一个以 task_id 为 key 的字典中
        tasksList.forEach(task => {
            task.children = [];
            taskMap[task.task_id] = task;
        });

        const result = [];

        // 遍历任务，将子任务添加到父任务的 children 中
        tasksList.forEach(task => {
            if (task.task_parent_id === null) {
                // 顶层任务，直接添加到结果中
                result.push(task);
            } else {
                // 子任务，添加到对应父任务的 children 中
                const parentTask = taskMap[task.task_parent_id];
                if (parentTask) {
                    parentTask.children.push(task);
                }
            }
        });

        return result;
    } else return null
}





module.exports = nestedTasks;