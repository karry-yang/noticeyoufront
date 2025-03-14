const STS = require('@alicloud/pop-core').RPCClient;
const dotenv = require('dotenv')
const env = process.env.NODE_ENV || 'development';
dotenv.config({ path: `.env.${env}` })
const config = {
    accessKeyId: process.env.ALIBABA_ACCESS_KEY_ID,
    accessKeySecret: process.env.ALIBABA_ACCESS_KEY_SECRET,
    roleArn: 'acs:ram::1682778109592147:role/notice-you-user',
    endpoint: 'https://sts.aliyuncs.com',
};

const client = new STS({
    accessKeyId: config.accessKeyId,
    accessKeySecret: config.accessKeySecret,
    endpoint: config.endpoint,
    apiVersion: '2015-04-01',
});

async function getTemporaryCredentials(company) {
    return client.request('AssumeRole', {
        RoleArn: config.roleArn,
        RoleSessionName: `${company}-session`,
        DurationSeconds: 3600,
        Policy: JSON.stringify({
            "Version": "1",
            "Statement": [{
                "Effect": "Allow",
                "Action": ["oss:PutObject", "oss:GetObject"],
                "Resource": [`acs:oss:*:*:notice-you/${company}/*`]
            }]
        })
    });
}

module.exports = getTemporaryCredentials;