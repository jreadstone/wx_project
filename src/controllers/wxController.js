const wxService = require('../services/wxService');
const encryptionModel = require('../models/encryptionModel');
const config = require('../../config');
const wxAuthService = require('../services/wxAuthService');
const logService = require('../services/logService');
const tokenService = require('../services/tokenService');

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

            // 记录收到的请求
            await logService.log('wx_verify_request', '收到微信验证请求', {
                url: req.url,
                query: req.query,
                headers: req.headers
            });

            // 检查配置的token
            await logService.log('wx_token_check', '当前配置的Token', {
                configuredToken: config.wx.token
            });

            // 检查必要参数
            if (!signature || !timestamp || !nonce) {
                const missingParams = [];
                if (!signature) missingParams.push('signature');
                if (!timestamp) missingParams.push('timestamp');
                if (!nonce) missingParams.push('nonce');

                await logService.log('wx_verify_error', '参数不完整', {
                    missingParams
                });

                return res.status(400).send('缺少参数: ' + missingParams.join(', '));
            }

            // 验证签名
            const isValid = await wxAuthService.verifySignature(signature, timestamp, nonce);

            // 记录验证结果
            await logService.log('wx_verify_result', '验证结果', {
                isValid,
                echostr: echostr || ''
            });

            if (isValid) {
                console.log('微信服务器验证成功，返回echostr:', echostr);
                return res.send(echostr);
            } else {
                console.log('微信服务器验证失败');
                return res.status(401).send('签名验证失败');
            }
        } catch (err) {
            await logService.log('wx_verify_error', '验证处理异常', {
                error: err.message,
                stack: err.stack
            });
            console.error('处理微信验证请求失败:', err);
            res.status(500).send('服务器错误');
        }
    }

    async getAccessToken(req, res) {
        try {
            const tokenData = await tokenService.getAccessToken();
            res.json({
                success: true,
                ...tokenData
            });
        } catch (err) {
            console.error('获取access_token失败:', err);
            res.status(500).json({
                success: false,
                error: err.message
            });
        }
    }
}

module.exports = new WxController(); 