const express = require('express');
const router = express.Router();
const wxController = require('../controllers/wxController');
const path = require('path');

// 根路由处理（微信验证和消息处理）
router.get('/', wxController.verifyServer.bind(wxController));
router.post('/', wxController.handleMessage.bind(wxController));

// 消息历史
router.get('/history', wxController.getHistory.bind(wxController));

// 加密配置相关
router.get('/encryption', (req, res) => {
    res.sendFile(path.join(__dirname, '../../public/encryption.html'));
});
router.get('/encryption/config', wxController.getEncryptConfig.bind(wxController));
router.get('/encryption/current', wxController.getCurrentKey.bind(wxController));
router.post('/encryption/generate', wxController.generateNewKey.bind(wxController));

// 访问令牌
router.get('/access_token', wxController.getAccessToken.bind(wxController));


module.exports = router; 