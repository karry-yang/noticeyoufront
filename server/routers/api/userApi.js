const express = require('express');
const WebSocket = require('ws');

const router = express.Router(); // 使用 Router 实例
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const sendMail = require('../../emailServer/mailer'); // 导入发送邮件的函数
const { use } = require('bcrypt/promises');
const redisClient = require('../../redisServer/redis'); // 引入 Redis 客户端
const snowflake = require('../../sonwFlakeIdServer/sonwFlakeid')
const apiHelp = require('../apiHelp/userApiHelp')
const settingApiHelp = require('../apiHelp/settingApiHelp')
const { authenticate } = require('../../utils/authenticate')
const secretKey = process.env.SECURETY_KEY
const userSettingApiHelp = require('../apiHelp/settingApiHelp')
const StatusCodes = require('../../utils/statusCodes');
const { permission } = require('process');
const { error } = require('console');
const { promisify } = require('util');
const { sendTransactionalMessage } = require('../../kafkaServer/producer'); // 引入生产者逻辑

const { clients } = require('../../index');

// 将 Redis 的 `set` 函数转换为 Promise 形式，方便使用 async/await
// const SnowflakeID = require('node-snowflake');
const setAsync = promisify(redisClient.set).bind(redisClient);
const getAsync = promisify(redisClient.get).bind(redisClient);
const mgetAsync = promisify(redisClient.mget).bind(redisClient);




router.post('/register', async(req, res, next) => {
    const {
        user_email,
        user_password,
        user_nickname,
        user_phone,
        user_gender,
        user_captcha,
        user_type
    } = req.body;

    try {
        // 检查验证码是否为空
        if (!user_captcha) {
            res.error(StatusCodes.NOT_FOUND, "验证码为空！", null);
        }

        // 从 Redis 获取验证码
        const redisCaptchaValue = await redisClient.get(String(user_email));
        console.log(`Captcha from Redis: ${redisCaptchaValue}`);

        // 如果 Redis 中没有对应的验证码
        if (redisCaptchaValue === null) {
            res.error(StatusCodes.NOT_FOUND, "验证码已过期或无效！", null);

        }

        // 比较验证码
        if (redisCaptchaValue !== user_captcha) {
            res.error(StatusCodes.NOT_FOUND, "验证码错误！", null);
        }

        // 检查邮箱是否已注册
        const existingUser = await apiHelp.checkUserByEmail(user_email);
        console.log(`Existing User: ${JSON.stringify(existingUser)}`);

        if (existingUser.length > 0) {
            res.error(StatusCodes.NOT_FOUND, "邮箱已被注册", null);
        }

        // 生成用户ID，哈希密码并插入用户数据，user_type_id
        const user_id = snowflake.generate();
        const user_user_type_id = snowflake.generate();
        const setting_id = snowflake.generate();
        const hashedPassword = await bcrypt.hash(user_password, 10);
        const isInsertedUser = await apiHelp.insertUser(
            user_id,
            user_email,
            user_nickname,
            user_phone,
            user_gender,
            hashedPassword,
            user_user_type_id,
            user_type
        );
        const isInsertedSetting = await settingApiHelp.isInsertedSetting(
            setting_id,
            user_id
        );

        if (!isInsertedUser || !isInsertedSetting) {
            res.error(StatusCodes.INTERNAL_SERVER_ERROR, "注册失败--服务器内部错误", null);

        }
        // 删除 Redis 中的验证码
        await redisClient.del(String(user_email));
        const user = { user_email, user_nickname, user_phone, user_gender }
            // 返回成功信息
        res.success(StatusCodes.SUCCESS, `注册成功，请检查您的邮箱以验证账户`, user)
    } catch (error) {
        res.error(StatusCodes.INTERNAL_SERVER_ERROR, "注册失败--服务器内部错误", null);
        next(error)

    }
});


router.get('/verify/:user_email', async(req, res) => {
    const { user_email } = req.params;

    try {
        // 验证邮箱并激活用户账户
        const isVerified = await apiHelp.verifyUser(user_email);
        if (isVerified) {
            res.success(StatusCodes.SUCCESS, "邮箱已成功验证", tomorrowTasks)
        } else {
            res.error(StatusCodes.NOT_FOUND, "邮箱验证失败--验证码错误", null);

        }
    } catch (error) {
        res.error(StatusCodes.INTERNAL_SERVER_ERROR, "邮箱验证失败--服务器内部错误", null);
    }
});

function generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString(); // 生成6位数验证码
}
//注册用户时的邮箱验证
router.post('/send-verification-code', async(req, res, next) => {
    // console.log(redisClient);

    const { user_email } = req.body;
    const verificationCode = generateVerificationCode();
    console.log(verificationCode)
    try {
        await sendMail(user_email, "验证码消息", verificationCode);
        await redisClient.set(user_email, verificationCode, 'EX', 300);
        res.success(StatusCodes.SUCCESS, "验证码发送成功", verificationCode)
    } catch (error) {
        console.log(error)
        res.error(StatusCodes.INTERNAL_SERVER_ERROR, "发送邮件时出错", error);
        // next()
    }
    // if (redisClient && redisClient.status !== 'end' && redisClient.status !== 'err') {
    //     try {
    //         await sendMail(user_email, "验证码消息", verificationCode);
    //         await redisClient.set(user_email, verificationCode, {
    //             EX: 300
    //         });
    //         console.log("result");
    //         res.status(200).json({ message: '验证码发送成功', code: verificationCode });
    //     } catch (error) {
    //         console.log('错误信息:', error);
    //         res.status(500).json({ message: '发送邮件时出错', error: error.message });
    //     }
    // } else {
    //     console.log('redisClient初始化失败或客户端已关闭!');
    //     res.status(500).json({ message: 'Redis 客户端未初始化或已关闭' });
    // }
});
//修改邮箱时的邮箱验证
router.post('/send-verificated-userEmail-code', async(req, res, next) => {
    const { user_email } = req.body;
    console.log(user_email)
    const user_id = req.userId
    const user = await getAsync(`${user_id}:userInfo`)
    console.log(user, typeof(user))
    let userObj = JSON.parse(user)
        // let userObj = user
    if (Object.keys(userObj).length === 0) {
        userObj = await apiHelp.checkUserById(user_id)

    }
    const verificationCode = generateVerificationCode();
    if (Object.keys(userObj).length !== 0) {
        if (user_id)

            console.log(verificationCode)
        try {
            await sendMail(user_email, "邮箱修改验证码消息", verificationCode);
            await redisClient.set(`${user_id}:verificationCode`, verificationCode, 'EX', 300);
            res.success(StatusCodes.SUCCESS, "验证码发送成功", { verificationCode: verificationCode })
        } catch (error) {
            console.log(error)
            res.error(StatusCodes.INTERNAL_SERVER_ERROR, "发送邮件时出错", null);
            // next()
        }
    } else {
        res.error(StatusCodes.INTERNAL_SERVER_ERROR, "用户不存着", error);
        next()
    }

});



// 用户输入邮箱密码登录系统，返回用户基本信息，缓存用户基本信息和设置
router.post('/login', async(req, res, next) => {
    const { user_email, user_password, rememberMe } = req.body;
    // console.log("前端传递登录数据，用户邮箱和密码:", user_email, user_password)
    try {
        const [user] = await apiHelp.checkUserByEmail(user_email);
        console.log("检查用户是否存在", user)
        const match = await bcrypt.compare(String(user_password), user.user_password);
        if (!match) {
            res.error(StatusCodes.UNAUTHORIZED, "登录失败，邮箱或密码错误");
        } else {
            const [user] = await apiHelp.checkUserAllInfoByUserEmail(user_email);
            console.log("查询用户全部信息", user)
            const userSettingArr = await userSettingApiHelp.checkAllUserSetting(user.user_id);
            const userSetting = userSettingArr[0]
            const token = jwt.sign({
                id: user.user_id,
                email: user.user_email,
                group: user.user_group,
                types: user.user_types,
                departments: user.user_departments,
                roleCodes: user.user_roles,
                authoritieCodes: user.user_authorities,
                isLogin: true
            }, secretKey, { expiresIn: rememberMe ? '30d' : '1h' });
            //使用开发环境，但是使用https
            const isProduction = process.env.NODE_ENV === 'development';
            res.cookie('jwtToken', token, {
                httpOnly: true,
                secure: true, // 生产环境使用 HTTPS,
                sameSite: isProduction ? 'None' : 'Lax', // 开发环境使用 'Lax' 以避免问题
                path: '/'
            });
            // 传递信息给前端
            const userInfo = { userId: user.user_id, userName: user.user_nickname, userEmail: user.user_email, userGender: user.user_gender, userGroup: user.user_group, userDepartments: user.user_departments, userImage: user.user_portrait, userTypes: user.user_types }
            console.log("传递给前端的user", userInfo)
            const roles = user.user_roles.split(',');
            const authorities = user.user_authorities.split(',');
            const data = {
                    isLogin: true, //登录标记
                    userInfo: userInfo, //用户信息
                    roles: roles, //角色信息
                    authorities: authorities, //权限信息
                    userSetting: userSetting, //设置信息
                    expiryTime: 60
                }
                // console.log("登录方法组合的userInfo:", data)
            res.success(StatusCodes.SUCCESS, "token验证成功", data)
            try {
                // 使用 Redis multi 批量存储
                const multi = redisClient.multi();
                multi.set(`${user.user_id}:userInfo`, JSON.stringify(user), 'EX', 3600);
                multi.set(`${user.user_id}:roles`, JSON.stringify(roles), 'EX', 3600);
                multi.set(`${user.user_id}:authorities`, JSON.stringify(authorities), 'EX', 3600);
                multi.set(`${user.user_id}:userSetting`, JSON.stringify(userSetting), 'EX', 3600);
                await multi.exec(); // 执行所有命令
                console.log(`用户${user.user_id}信息和设置已批量缓存到 Redis`);
            } catch (redisError) {
                console.error(`用户${user.user_id}缓存到 Redis 时出错:`, redisError);
            }

            console.log(`用户${user.user_id}登录成功！`);

        }
    } catch (error) {
        res.error(StatusCodes.INTERNAL_SERVER_ERROR, "登录服务器内部错误或者数据传输有错误", null);
        next(error);
    }
});


router.post('/refresh-token', (req, res, next) => {
    console.log("refresh-token")
    const token = req.cookies.jwtToken; // 从 Cookie 中读取当前 Token
    if (!token) {
        return res.error(StatusCodes.INTERNAL_SERVER_ERROR, "无效的 Token 或 Token 已过期");
    }

    try {
        // 验证当前 Token 是否有效
        const decoded = jwt.verify(token, secretKey);

        // 生成新的 Token
        const token = jwt.sign({
            id: decoded.id,
            email: decoded.email,
            groupId: decoded.groupId,
            type: decoded.type,
            departmentId: decoded.departmentId,
            roleCodes: decoded.roleCodes,
            authoritieCodes: decoded.authoritieCodes,
            isLogin: true
        }, secretKey, { expiresIn: '1h' });
        //使用开发环境，但是使用https
        const isProduction = process.env.NODE_ENV === 'development';
        res.cookie('jwtToken', token, {
            httpOnly: true,
            secure: true, // 生产环境使用 HTTPS,
            sameSite: isProduction ? 'None' : 'Lax', // 开发环境使用 'Lax' 以避免问题
            path: '/'
        });
        startConsumer(clients);
        res.success(StatusCodes.SUCCESS, "验证成功", { tokenExpiry: 60 })
            // res.status(200).json({
            //     success: true,
            //     message: 'Token 刷新成功',
            //     expiryTime: TOKEN_EXPIRY_TIME, // 返回新的 Token 有效期
            // });
    } catch (error) {
        console.error('Token 刷新失败:', error);
        res.error(StatusCodes.INTERNAL_SERVER_ERROR, "无效的 Token 或 Token 已过期");
        next(error);
        // res.status(401).json({ success: false, message: '' });
    }
});
router.post("/validate-session", async(req, res, next) => {
    const user_id = req.userId
    const token = req.cookies.jwtToken;
    console.log("validate-session");
    if (!token) return res.status(401).json({ success: false, message: "未登录" });
    const payload = jwt.verify(token, secretKey);
    if (user_id === payload.id)
        try {

            // const userInfoStr = await redisClient.get(`${user_id}:userInfo`);
            // const rolesStr = await redisClient.get(`${user_id}:roles`);
            // const authoritiesStr = await redisClient.get(`${user_id}:authorities`);

            const userSettingStr = await redisClient.get(`${payload.id}:userSetting`);
            // const userInfo = userInfoStr ? JSON.parse(userInfoStr) : null;
            // const roles = userInfoStr ? JSON.parse(rolesStr) : null;
            // const authorities = userInfoStr ? JSON.parse(authoritiesStr) : null;
            const userSetting = userSettingStr ? JSON.parse(userSettingStr) : null;

            const data = {
                ...payload,
                userSetting: userSetting //设置信息
            }
            res.success(StatusCodes.SUCCESS, "刷新成功", data)
        } catch (error) {
            res.error(StatusCodes.INTERNAL_SERVER_ERROR, "登录已过期");
            next(error)
        }
});

router.post("/updateUserInfo", async(req, res, next) => {
    const user_id = req.userId
    const { userName, userGender, userType } = req.body;
    console.log(userName, userGender, userType)

    try {
        const result = await apiHelp.updateUser(user_id, userName, userGender, userType)
        if (result[0].changedRows > 0) {
            // 更新成功，检查并更新缓存
            let userInfo = await getAsync(`${user_id}:userInfo`);
            if (!userInfo) {
                // 如果缓存中没有用户数据，重新从数据库中获取完整数据
                const dbUserInfo = await apiHelp.checkUserAllInfoById(user_id); // 假设该方法从数据库获取完整用户信息
                if (!dbUserInfo) {
                    throw new Error("Failed to retrieve user info from database");
                }
                userInfo = dbUserInfo; // 使用完整数据初始化缓存
            } else {
                // 如果缓存中有数据，更新其中需要修改的字段
                userInfo = JSON.parse(userInfo);
                userInfo = {
                    ...userInfo,
                    user_nickname: userName,
                    user_gender: userGender,
                    user_type: userType,
                };
            }

            // 将更新后的数据写入 Redis
            await setAsync(`${user_id}:userInfo`, JSON.stringify(userInfo));

            return res.success(StatusCodes.SUCCESS, "修改成功", {});
        } else {
            return res.error(StatusCodes.BAD_REQUEST, "未更新任何数据");
        }
    } catch (error) {
        console.log(error)
        res.error(StatusCodes.INTERNAL_SERVER_ERROR, "修改失败");

    }
});
router.post("/updateUserEmail", async(req, res) => {
    const user_id = req.userId;
    const { newUserEmail, verificationCode } = req.body;

    try {
        // 验证码验证
        const verificationCodeInRedis = await getAsync(`${user_id}:verificationCode`);
        if (verificationCode !== verificationCodeInRedis) {
            return res.error(StatusCodes.BAD_REQUEST, "验证码不正确或已过期");
        }

        // 删除验证码
        await redisClient.del(`${user_id}:verificationCode`);

        // 更新邮箱
        const result = await apiHelp.updateUserEmail(user_id, newUserEmail);
        if (result && result.affectedRows > 0) {
            //更新缓存
            let userInfo = await getAsync(`${user_id}:userInfo`)
            userInfo = JSON.parse(userInfo)
            userInfo = {...userInfo, user_email: newUserEmail }
            await setAsync(`${user_id}:userInfo`, JSON.stringify(userInfo))
            return res.success(StatusCodes.SUCCESS, "邮箱修改成功", {});
        } else {
            return res.error(StatusCodes.BAD_REQUEST, "邮箱修改失败");
        }
    } catch (error) {
        console.error("Error in updateUserEmail:", error.message);
        return res.error(
            StatusCodes.INTERNAL_SERVER_ERROR,
            "邮箱修改失败，请稍后重试"
        );
    }
});
router.post("/getAllDepartmentByUserGroupId", async(res, req, next) => {
    const user_id = req.userId;
    const { userGroupId } = req.body;
    try {
        const rusult = await apiHelp.getAllDepartmentByUserGroupId(userGroupId, user_id)

    } catch (error) {

    }
})
router.post("/updateUserDepartment", async(req, res) => {
    const user_id = req.userId;
    const { newUserEmail, verificationCode } = req.body;

    try {
        // 验证码验证
        const verificationCodeInRedis = await getAsync(`${user_id}:verificationCode`);
        if (verificationCode !== verificationCodeInRedis) {
            return res.error(StatusCodes.BAD_REQUEST, "验证码不正确或已过期");
        }

        // 删除验证码
        await redisClient.del(`${user_id}:verificationCode`);

        // 更新邮箱
        const result = await apiHelp.updateUserEmail(user_id, newUserEmail);
        if (result && result.affectedRows > 0) {
            //更新缓存
            let userInfo = await getAsync(`${user_id}:userInfo`)
            userInfo = JSON.parse(userInfo)
            userInfo = {...userInfo, user_email: newUserEmail }
            await setAsync(`${user_id}:userInfo`, JSON.stringify(userInfo))
            return res.success(StatusCodes.SUCCESS, "邮箱修改成功", {});
        } else {
            return res.error(StatusCodes.BAD_REQUEST, "邮箱修改失败");
        }
    } catch (error) {
        console.error("Error in updateUserEmail:", error.message);
        return res.error(
            StatusCodes.INTERNAL_SERVER_ERROR,
            "邮箱修改失败，请稍后重试"
        );
    }
});

// 测试发送消息
router.post('/send-message', (req, res) => {
    const { userId, message } = req.body;

    // 生产消息到 Kafka
    sendMessage('user-messages', { userId, message })
        .then(() => {
            res.status(200).json({ message: 'Message sent successfully' });
        })
        .catch((error) => {
            res.status(500).json({ message: 'Failed to send message', error });
        });
});
//更新用户信息


module.exports = router; // 确保导出的是 router