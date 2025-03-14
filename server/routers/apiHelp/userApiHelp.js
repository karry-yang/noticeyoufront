const { mysql, getMySqlConnection } = require('../../mysql');

async function checkUserAllInfoByUserEmail(user_email) {
    const sqlString = ` 
    SELECT 
        u.user_id, 
        u.user_email, 
        u.user_nickname,
        u.user_password,
        u.user_portrait,
        GROUP_CONCAT(DISTINCT ut.type_name) AS user_types, -- 用户类型字段
        u.user_superior_id,
        u.user_is_vip,
        u.user_is_online,
        u.user_phone,
        u.user_gender,
        CONCAT('[', 
            GROUP_CONCAT(DISTINCT CONCAT('{', '"', g.group_id, '":"', g.group_name, '"', '}')), 
        ']') AS user_group,
        CONCAT('[', 
            GROUP_CONCAT(DISTINCT CONCAT('{', '"', d.department_id, '":"', d.department_name, '"', '}')), 
        ']') AS user_departments, -- 修改：手动构造 JSON 格式的 departments
        GROUP_CONCAT(DISTINCT r.role_code) AS user_roles, 
        GROUP_CONCAT(DISTINCT a.authority_code) AS user_authorities
    FROM 
        user u
    LEFT JOIN
        \`group\` g ON u.user_group_id = g.group_id
    LEFT JOIN
        user_department ud ON u.user_id = ud.user_id
    LEFT JOIN
        department d ON ud.department_id = d.department_id
    LEFT JOIN 
        user_roles ur ON u.user_id = ur.user_id
    LEFT JOIN 
        role r ON ur.role_id = r.role_id
    LEFT JOIN 
        role_authorities ra ON r.role_id = ra.role_id
    LEFT JOIN 
        authority a ON ra.authority_id = a.authority_id
    LEFT JOIN 
        user_user_type uut ON u.user_id = uut.user_id -- 新增：连接用户用户类型中间表
    LEFT JOIN 
        user_type ut ON uut.user_type_id = ut.type_id -- 新增：连接用户类型表
    WHERE 
        u.user_email = '${user_email}'
    GROUP BY 
        u.user_email;
`;


    const [results] = await mysql.query(sqlString);
    return results;
}
async function checkUserAllInfoById(user_id) {
    const sqlString = ` 
    SELECT 
        u.user_id, 
        u.user_email, 
        u.user_nickname,
        u.user_password,
        u.user_portrait,
        GROUP_CONCAT(DISTINCT ut.type_name) AS user_types, -- 修改：新增用户类型字段
        u.user_superior_id,
        u.user_is_vip,
        u.user_is_online,
        u.user_phone,
        u.user_gender,
         CONCAT('[', 
            GROUP_CONCAT(DISTINCT CONCAT('{', '"', g.group_id, '":"', g.group_name, '"', '}')), 
        ']') AS user_group,
               CONCAT('[', 
            GROUP_CONCAT(DISTINCT CONCAT('{', '"', d.department_id, '":"', d.department_name, '"', '}')), 
        ']') AS user_departments, -- 修改：手动构造 JSON 格式的 departments
        GROUP_CONCAT(DISTINCT r.role_code) AS user_roles, 
        GROUP_CONCAT(DISTINCT a.authority_code) AS user_authorities
    FROM 
        user u
    LEFT JOIN
        \`group\` g ON u.user_group_id = g.group_id
    LEFT JOIN
        user_department ud ON u.user_id = ud.user_id
    LEFT JOIN
        department d ON ud.department_id = d.department_id
    LEFT JOIN 
        user_roles ur ON u.user_id = ur.user_id
    LEFT JOIN 
        role r ON ur.role_id = r.role_id
    LEFT JOIN 
        role_authorities ra ON r.role_id = ra.role_id
    LEFT JOIN 
        authority a ON ra.authority_id = a.authority_id
    LEFT JOIN 
        user_user_type uut ON u.user_id = uut.user_id -- 新增：连接用户用户类型中间表
    LEFT JOIN 
        user_type ut ON uut.user_type_id = ut.type_id -- 新增：连接用户类型表
    WHERE 
        u.user_id = '${user_id}'
    GROUP BY 
        u.user_email;
`;

    const [results] = await mysql.query(sqlString, [user_id]);
    // console.log(results)
    return results;
}


async function checkUserByEmail(user_email) {
    const [results] = await mysql.query('SELECT * FROM user WHERE user_email=?', [user_email]);
    return results;
}

async function checkAllUsers() {
    const [results] = await mysql.query('SELECT * FROM user');
    return results;
}

async function checkUserById(user_id) {
    const [results] = await mysql.query('SELECT * FROM user WHERE user_id = ?', [user_id]);
    return results;
}


//插入数据，并且生成默认设置
// 开启事务，加入用户信息和user_type
async function insertUser(
    user_id,
    user_email,
    user_nickname,
    user_phone,
    user_gender,
    hashedPassword,
    user_user_type_id,
    user_type) {

    const sqlInsertUser = `insert into user(
        user_id,
        user_email,
        user_nickname,
        user_phone,
        user_gender,
        user_password)
        VALUES(?,?,?,?,?,?)`;

    const sqlInsertUserUserType = `
        INSERT INTO \`user_user_type\` (
            \`user_user_type_id\`,
            \`user_id\`,
            \`user_type_id\`
        ) 
        VALUES (?, ?, ?)
    `;

    const connection = await getMySqlConnection();
    try {
        await connection.beginTransaction(); // 开始事务

        // 插入基本信息
        const result = await connection.query(sqlInsertUser, [
            user_id,
            user_email,
            user_nickname,
            user_phone,
            user_gender,
            hashedPassword
        ]);

        // 插入user_user_type
        await connection.query(sqlInsertUserUserType, [user_user_type_id, user_id, user_type])

        await connection.commit(); // 提交事务
        return result;
    } catch (error) {
        await connection.rollback(); // 回滚事务
        console.error('Transaction failed:', error);
        throw error;
    } finally {
        connection.release(); // 释放连接
    }



}

async function updateUserPortrait(user_id, user_portrait) {
    const result = await mysql.query(`UPDATE user SET  user_portrait = ?,update_time = NOW() 
        WHERE user_id = ?
`, [user_portrait, user_id])
    return result

}
async function updateUser(user_id, user_name, user_gender, user_type) {
    const result = await mysql.query(`UPDATE user SET  user_nickname = ?,user_gender=?,user_type=?,update_time = NOW() 
        WHERE user_id = ?
`, [user_name, user_gender, user_type, user_id])
    return result

}

async function updateUserEmail(user_id, new_user_email) {
    const connection = await getMySqlConnection(); // 获取数据库连接

    try {
        // 开启事务
        await connection.beginTransaction();

        // 执行更新
        const [result] = await connection.query(
            'UPDATE user SET user_email = ? WHERE user_id = ?', [new_user_email, user_id]
        );

        if (result.affectedRows === 0) {
            throw new Error("未更新任何记录");
        }

        await connection.commit(); // 提交事务
        return result;
    } catch (error) {
        await connection.rollback(); // 回滚事务
        console.error("Transaction error:", error.message);
        throw error;
    } finally {
        connection.release(); // 释放数据库连接
    }
}
async function checkGroupLeader(group_id) {
    const sql = `  SELECT user_id 
FROM user WHERE user_group_id = ? AND user_superior_id IS NULL;`
    await mysql.query(sql, [group_id])

}
module.exports = {
    checkUserAllInfoByUserEmail, //通过邮箱查看用户所有信息，包括部门，角色，权限bi
    checkUserAllInfoById,
    insertUser,
    // login, //登录 
    // insertUser, //插入用户
    checkAllUsers, //查找所有用户信息
    checkUserById, //根据 用户id  查询用户信息
    checkUserByEmail, //根据 用户email 查询用户信息
    updateUserEmail, //根据 用户email 查询用户信息
    updateUserPortrait, //根据用户id更新用头像
    updateUser,
    checkGroupLeader,

};