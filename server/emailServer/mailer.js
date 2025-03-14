const nodemailer = require('nodemailer');
const dotenv = require('dotenv')
const env = process.env.NODE_ENV || 'development';
dotenv.config({ path: `.env.${env}` })
const transporter = nodemailer.createTransport({
    host: "smtp.qq.com",
    port: 465, // 使用 465 端口（SSL）
    secure: true,
    auth: {
        user: process.env.EMAIL_USER, // 你的邮箱地址
        pass: process.env.EMAIL_PASS // 你的邮箱授权码
    }
});

const sendMail = (to, subject, text) => {
    console.log("邮箱功能启动---发送给了", to)
    return transporter.sendMail({
        from: process.env.EMAIL_USER,
        to,
        subject,
        text
    });
};

module.exports = sendMail;