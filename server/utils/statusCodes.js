const StatusCodes = {
    // 成功
    SUCCESS: { code: 200, message: '请求成功' },
    CREATED: { code: 201, message: '资源创建成功' },
    ACCEPTED: { code: 202, message: '请求已接受，正在处理' },
    NO_CONTENT: { code: 204, message: '请求成功，但无内容返回' },

    // 重定向
    MOVED_PERMANENTLY: { code: 301, message: '永久移动' },
    FOUND: { code: 302, message: '临时移动' },
    NOT_MODIFIED: { code: 304, message: '未修改' },

    // 客户端错误
    BAD_REQUEST: { code: 400, message: '请求参数错误' },
    UNAUTHORIZED: { code: 401, message: '未授权访问' },
    FORBIDDEN: { code: 403, message: '禁止访问' },
    NOT_FOUND: { code: 404, message: '资源未找到' },
    METHOD_NOT_ALLOWED: { code: 405, message: '不允许使用该请求方法' },
    NOT_ACCEPTABLE: { code: 406, message: '无法接受请求的内容类型' },
    PROXY_AUTHENTICATION_REQUIRED: { code: 407, message: '需要代理身份验证' },
    REQUEST_TIMEOUT: { code: 408, message: '请求超时' },
    CONFLICT: { code: 409, message: '请求冲突' },
    GONE: { code: 410, message: '资源已被删除' },
    LENGTH_REQUIRED: { code: 411, message: '需要Content-Length头部' },
    PRECONDITION_FAILED: { code: 412, message: '前置条件失败' },
    UNPROCESSABLE_ENTITY: { code: 422, message: '无法处理的实体' },
    LOCKED: { code: 423, message: '资源被锁定' },
    FAILED_DEPENDENCY: { code: 424, message: '依赖关系失败' },
    TOO_MANY_REQUESTS: { code: 429, message: '请求过多，限制访问' },

    // 服务器错误
    INTERNAL_SERVER_ERROR: { code: 500, message: '服务器内部错误' },
    NOT_IMPLEMENTED: { code: 501, message: '未实现的请求功能' },
    BAD_GATEWAY: { code: 502, message: '错误的网关' },
    SERVICE_UNAVAILABLE: { code: 503, message: '服务不可用' },
    GATEWAY_TIMEOUT: { code: 504, message: '网关超时' },
    HTTP_VERSION_NOT_SUPPORTED: { code: 505, message: '不支持的HTTP版本' },
};

module.exports = StatusCodes;