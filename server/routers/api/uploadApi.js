const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ dest: 'uploads/' }); // 指定临时文件存储目录
const ossClient = require('../../ossServer/ossConfig');
const fs = require('fs');
const path = require('path');
const StatusCodes = require('../../utils/statusCodes');
const redisClient = require('../../redisServer/redis');
const { promisify } = require('util');
const setAsync = promisify(redisClient.set).bind(redisClient);
const getAsync = promisify(redisClient.get).bind(redisClient);
const userApiHelp = require('../apiHelp/userApiHelp')


const generateSignedUrl = async(objectKey) => {
    try {
        // 签名 URL，有效期为 1 小时
        const signedUrl = ossClient.signatureUrl(objectKey, {
            expires: 3600, // 有效时间（秒）
        });
        return signedUrl;
    } catch (error) {
        console.error('签名 URL 生成失败：', error);
        throw error;
    }
};
// 文件上传接口
router.post('/upload', upload.single('file'), async(req, res, next) => {
    const task_id = req.body
    const user_id = req.userId
    const group_id = req.groupId
    const department_id = req.departmentId
    const roleCode = req.roleCodes
    const authoritieCodes = req.authoritieCodes
    const file = req.file;
    const fileName = file.originalname;
    const date = new Date().toISOString().split('T')[0];
    const objectKey = `${group_id}/${department_id}/${user_id}/${task_id}/${date}/${fileName}`;
    //上传的文件路劲临时保存user_id：task_id：date+fileName
    try {
        const result = await ossClient.put(objectKey, file.path);
        fs.unlinkSync(file.path); // 删除临时文件
        if (result && result.res && result.res.status === 200) {
            console.log("阿里云返回的文件上传结构：", result);
            redisClient.setAsync(`${user_id}:${task_id}:upload`, result.url);
            res.success(StatusCodes.SUCCESS, `${user_id}--/upload-- redisClient.setAsync`, tasksList);
        } else {
            res.error(StatusCodes.INTERNAL_SERVER_ERROR, `${user_id}--/upload--redisClient.setAsync`, null);
            next()
        }

    } catch {
        res.error(StatusCodes.INTERNAL_SERVER_ERROR, `${user_id}--/upload`, null);
        next()
    }

});

// 获取文件列表接口
router.get('/files', (req, res) => {
    const sql = 'SELECT * FROM files ORDER BY upload_time DESC';
    db.query(sql, (err, results) => {
        if (err) return res.status(500).send('查询文件列表失败');
        res.json(results);
    });
});






// 处理头像上传的 API 路由
router.post("/uploadAvatar", upload.single("image"), async(req, res) => {
    const user_id = req.userId;

    if (!user_id) {
        return res.status(400).send({ error: "用户未登录，无法上传头像！" });
    }

    try {
        const { file } = req; // 从请求中获取上传的文件
        if (!file) {
            return res.status(400).send({ error: "未检测到文件上传！" });
        }

        // 上传文件到阿里云 OSS
        const objectKey = `${user_id}/user_portrait`;
        await ossClient.put(objectKey, file.path);

        // 可选：删除本地临时文件
        fs.unlink(file.path, (err) => {
            if (err) console.error(`删除临时文件 ${file.path} 失败：`, err);
        });
        const signedUrl = await generateSignedUrl(objectKey);
        console.log(signedUrl)
            // 更新数据库中的用户头像路径
        await userApiHelp.updateUserPortrait(user_id, signedUrl);

        // 更新 Redis 中的用户信息
        let userInfo = JSON.parse(await getAsync(`${user_id}:userInfo`));
        userInfo = {...userInfo, user_portrait: signedUrl };
        await setAsync(`${user_id}:userInfo`, JSON.stringify(userInfo));

        // 返回成功响应
        res.success(StatusCodes.SUCCESS, "头像上传成功！", userInfo);

    } catch (error) {
        console.error("头像上传失败：", error);
        res.error(StatusCodes.INTERNAL_SERVER_ERROR, "头像上传失败，请稍后再试！", null);
    }
});
//获取用户头像
router.get('/getAvatarUrl', async(req, res) => {
    const user_id = req.userId;
    try {
        const objectKey = `${user_id}/user_portrait`;
        const signedUrl = await generateSignedUrl(objectKey);
        res.success(StatusCodes.SUCCESS, "头像获取成功！", { userPortraitUrl: signedUrl });

    } catch (error) {
        res.error(StatusCodes.INTERNAL_SERVER_ERROR, "头像获取失败", null);
    }
});


module.exports = router;