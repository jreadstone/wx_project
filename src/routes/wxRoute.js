const express = require('express');
const router = express.Router();
const wxController = require('../controllers/wxController');

// 处理微信服务器的消息推送
router.post('/', wxController.handleMessage.bind(wxController));

// 获取消息历史的接口
router.get('/history', wxController.getHistory.bind(wxController));

module.exports = router; 