async function nestedListicles(listiclesList) {

    const listicleMap = {};

    // 将任务存入一个以 listicle_id 为 key 的字典中
    listiclesList.forEach(listicle => {
        listicle.children = [];
        listicleMap[listicle.listicle_id] = listicle;
    });

    const result = [];

    // 遍历任务，将子任务添加到父任务的 children 中
    listiclesList.forEach(listicle => {
        if (listicle.listicle_parent_id === null) {
            // 顶层任务，直接添加到结果中
            result.push(listicle);
        } else {
            // 子任务，添加到对应父任务的 children 中
            const parentlisticle = listicleMap[listicle.listicle_parent_id];
            if (parentlisticle) {
                parentlisticle.children.push(listicle);
            }
        }
    });

    return result;
}





module.exports = nestedListicles;