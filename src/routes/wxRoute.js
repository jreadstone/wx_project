const express = require('express');
const router = express.Router();
const wxController = require('../controllers/wxController');
const path = require('path');

// 微信服务器验证接口
router.get('/', wxController.verifyServer.bind(wxController));

// 处理微信服务器的消息推送
router.post('/', wxController.handleMessage.bind(wxController));

// 获取消息历史的接口
router.get('/history', wxController.getHistory.bind(wxController));

// 加密配置管理页面
router.get('/encryption', (req, res) => {
    res.sendFile(path.join(__dirname, '../../public/encryption.html'));
});

// 获取加密配置信息
router.get('/encryption/config', wxController.getEncryptConfig.bind(wxController));

// 获取当前密钥
router.get('/encryption/current', wxController.getCurrentKey.bind(wxController));

// 生成新密钥
router.post('/encryption/generate', wxController.generateNewKey.bind(wxController));

// 获取access_token
router.get('/access_token', wxController.getAccessToken.bind(wxController));

module.exports = router; 