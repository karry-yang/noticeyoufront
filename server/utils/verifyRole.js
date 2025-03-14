// 角色验证中间件
function restrictToRole(role) {
    return (req, res, next) => {
        if (req.role !== role) {
            return res.status(403).send({ message: '权限不够！' });
        }
        next();
    };
}