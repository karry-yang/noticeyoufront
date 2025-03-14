// api.js
const express = require('express');
const router = express.Router();
const userApi = require('../api/userApi');
const taskApi = require('../api/taskApi');
const noteApi = require('../api/noteApi');
const tagApi = require('../api/tagApi');
const settingApi = require('../api/settingApi');
const hobitApi = require('../api/hobitApi');
const listicleApi = require('../api/listicleApi');
const uploadApi = require('../api/uploadApi');
const groupApi = require('../api/groupApi');
const departmentApi = require('../api/departmentApi');
// 统一管理多个API模块
router.use('/user', userApi); // 用户相关API
router.use('/task', taskApi); // 任务相关API
router.use('/note', noteApi); // 笔记相关API
router.use('/tag', tagApi); // 标签相关API
router.use('/setting', settingApi); // 笔记相关API
router.use('/user', userApi); // 笔记相关API
router.use('/hobit', hobitApi); // 笔记相关API
router.use('/listicle', listicleApi); // 笔记相关API
router.use('/upload', uploadApi); // 笔记相关API
router.use('/group', groupApi); // 组群相关API
router.use('/department', departmentApi); // 部门相关API

module.exports = router;