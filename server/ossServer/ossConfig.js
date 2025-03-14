// ossConfig.js
const OSS = require('ali-oss');

const dotenv = require('dotenv')
const env = process.env.NODE_ENV || 'development';
dotenv.config({ path: `.env.${env}` })
const ossClient = new OSS({
    region: `oss-cn-shenzhen`,
    accessKeyId: process.env.ALIBABA_ACCESS_KEY_ID,
    accessKeySecret: process.env.ALIBABA_ACCESS_KEY_SECRET,
    bucket: 'notice-you',
});

module.exports = ossClient;