async function nestedTags(tagsList) {

    const tagMap = {};

    // 将任务存入一个以 tag_id 为 key 的字典中
    tagsList.forEach(tag => {
        tag.children = [];
        tagMap[tag.tag_id] = tag;
    });

    const result = [];

    // 遍历任务，将子任务添加到父任务的 children 中
    tagsList.forEach(tag => {
        if (tag.tag_parent_id === null) {
            // 顶层任务，直接添加到结果中
            result.push(tag);
        } else {
            // 子任务，添加到对应父任务的 children 中
            const parentTag = tagMap[tag.tag_parent_id];
            if (parentTag) {
                parentTag.children.push(tag);
            }
        }
    });

    return result;
}





module.exports = nestedTags;