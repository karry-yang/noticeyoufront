const StatusCodes = require('./statusCodes');
// 通用响应中间件
function responseMiddleware(req, res, next) {
    // 处理成功响应
    res.success = function(statusCode = StatusCodes.SUCCESS, message = null, resultsData = null) {
        res.status(statusCode.code).json({
            codeStatus: statusCode.code,
            message: message || statusCode.message,
            resultsData: resultsData
        });
    };


    // 处理错误响应
    res.error = function(statusCode = StatusCodes.INTERNAL_SERVER_ERROR, message = null, resultsData = null) {
        res.status(statusCode.code).json({
            codeStatus: statusCode.code,
            message: message || statusCode.message, // 使用自定义消息或默认消息
            resultsData: resultsData
        });
    };

    next();
}

module.exports = responseMiddleware;