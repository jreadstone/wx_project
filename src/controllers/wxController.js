const wxService = require('../services/wxService');
const encryptionModel = require('../models/encryptionModel');
const config = require('../../config');
const wxAuthService = require('../services/wxAuthService');
const logService = require('../services/logService');
const tokenService = require('../services/tokenService');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { parseString } = require('xml2js');

class WxController {
    async handleMessage(req, res) {
        const xmlData = req.body;
        const timestamp = new Date();
        const dateStr = timestamp.toISOString().split('T')[0].replace(/-/g, '');
        const hourStr = timestamp.getHours().toString().padStart(2, '0');
        const dirPath = path.join(__dirname, '../../data', dateStr);
        const filePath = path.join(dirPath, `${dateStr}-${hourStr}.log`);

        console.log('Received message at:', timestamp);
        console.log('Directory path:', dirPath);
        console.log('File path:', filePath);

        if (!fs.existsSync(dirPath)) {
            console.log('Directory does not exist, creating:', dirPath);
            fs.mkdirSync(dirPath, { recursive: true });
        }

        parseString(xmlData, (err, result) => {
            if (err) {
                console.error('Failed to parse XML:', err);
                res.status(500).send('Internal Server Error');
                return;
            }

            const message = result.xml;
            const responseMessage = this.createResponseMessage(message);

            const logEntry = {
                timestamp: timestamp.toISOString(),
                request: message,
                response: responseMessage
            };

            console.log('Log entry:', logEntry);

            try {
                fs.appendFileSync(filePath, JSON.stringify(logEntry) + '\n');
                console.log('Log entry written to file:', filePath);
            } catch (writeErr) {
                console.error('Failed to write log entry to file:', writeErr);
            }

            res.set('Content-Type', 'application/xml');
            res.send(responseMessage);
        });
    }

    createResponseMessage(message) {
        // 根据接收到的消息创建响应消息
        const toUser = message.FromUserName[0];
        const fromUser = message.ToUserName[0];
        const content = '欢迎开启公众号开发者模式';

        return `
            <xml>
                <ToUserName><![CDATA[${toUser}]]></ToUserName>
                <FromUserName><![CDATA[${fromUser}]]></FromUserName>
                <CreateTime>${Math.floor(Date.now() / 1000)}</CreateTime>
                <MsgType><![CDATA[text]]></MsgType>
                <Content><![CDATA[${content}]]></Content>
            </xml>
        `;
    }

    async getHistory(req, res) {
        const dataDir = path.join(__dirname, '../../data');
        const files = fs.readdirSync(dataDir).sort().reverse();

        for (const dateDir of files) {
            const dateDirPath = path.join(dataDir, dateDir);
            if (fs.statSync(dateDirPath).isDirectory()) {
                const logFiles = fs.readdirSync(dateDirPath).sort().reverse();
                for (const logFile of logFiles) {
                    const logFilePath = path.join(dateDirPath, logFile);
                    const logEntries = fs.readFileSync(logFilePath, 'utf-8').trim().split('\n');
                    if (logEntries.length > 0) {
                        const latestEntry = logEntries[logEntries.length - 1];
                        res.json(JSON.parse(latestEntry));
                        return;
                    }
                }
            }
        }

        res.status(404).send('No history found');
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