const wxService = require('../services/wxService');
const encryptionModel = require('../models/encryptionModel');
const config = require('../../config');
const wxAuthService = require('../services/wxAuthService');
const logService = require('../services/logService');

class WxController {
    async handleMessage(req, res) {
        let rawData = '';
        req.on('data', chunk => {
            rawData += chunk;
        });

        req.on('end', async () => {
            try {
                // 解析接收到的消息
                const result = await wxService.parseXmlMessage(rawData);

                // 保存接收到的消息
                wxService.saveMessage({
                    type: 'received',
                    timestamp: new Date().toISOString(),
                    content: result.xml,
                    raw: rawData
                });

                // 创建回复消息
                const replyMessage = wxService.createReplyMessage(
                    result.xml.FromUserName[0],
                    result.xml.ToUserName[0]
                );

                // 转换为XML
                const replyXml = await wxService.buildXmlReply(replyMessage);

                // 保存回复消息
                wxService.saveMessage({
                    type: 'reply',
                    timestamp: new Date().toISOString(),
                    content: replyMessage,
                    raw: replyXml
                });

                res.type('application/xml');
                res.send(replyXml);
            } catch (err) {
                console.error('处理消息失败:', err);
                res.send('success');
            }
        });
    }

    getHistory(req, res) {
        const history = wxService.getMessageHistory();
        res.json(history);
    }

    async showEncryptionPage(req, res) {
        res.render('encryption', {
            title: '加密配置管理',
            currentMode: config.wx.encryptMode
        });
    }

    async generateNewKey(req, res) {
        try {
            // 强制生成新的key
            const newKey = encryptionModel.generateEncodingAESKey();
            encryptionModel.encodingAESKey = newKey;
            await encryptionModel.saveToFile();
            
            res.json({
                success: true,
                key: newKey
            });
        } catch (err) {
            console.error('生成新密钥失败:', err);
            res.status(500).json({
                success: false,
                error: err.message
            });
        }
    }

    async getCurrentKey(req, res) {
        try {
            const key = await encryptionModel.getEncodingAESKey();
            res.json({
                success: true,
                key: key
            });
        } catch (err) {
            console.error('获取当前密钥失败:', err);
            res.status(500).json({
                success: false,
                error: err.message
            });
        }
    }

    async getEncryptConfig(req, res) {
        try {
            res.json({
                success: true,
                encryptMode: config.wx.encryptMode
            });
        } catch (err) {
            console.error('获取加密配置失败:', err);
            res.status(500).json({
                success: false,
                error: err.message
            });
        }
    }

    async verifyServer(req, res) {
        try {
            const {
                signature,
                timestamp,
                nonce,
                echostr
            } = req.query;

            // 记录验证请求
            await logService.log('auth_request', '收到微信验证请求', {
                signature,
                timestamp,
                nonce
            });

            if (!signature || !timestamp || !nonce) {
                await logService.log('auth_error', '验证参数不完整');
                return res.status(400).send('参数不完整');
            }

            const isValid = wxAuthService.verifySignature(signature, timestamp, nonce);
            await logService.log('auth_result', isValid ? '验证成功' : '验证失败', {
                signature,
                timestamp,
                nonce,
                isValid
            });

            if (isValid) {
                return res.send(echostr);
            } else {
                return res.status(401).send('签名验证失败');
            }
        } catch (err) {
            await logService.log('auth_error', '验证处理失败', { error: err.message });
            res.status(500).send('服务器错误');
        }
    }
}

module.exports = new WxController(); 