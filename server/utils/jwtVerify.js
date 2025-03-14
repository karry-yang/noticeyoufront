const jwt = require('jsonwebtoken');


async function jwtVerifyHandle(jwtToken) {
    try {
        const user = jwt.verify(jwtToken, process.env.SECURETY_KEY); // 验证 JWT
        return user; // 返回解码后的用户数据
    } catch (error) {
        console.error("JWT verification failed:", error.message);
        throw new Error('Invalid JWT');
    }
}

module.exports = jwtVerifyHandle;