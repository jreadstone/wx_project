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
        let xmlData = '';
        req.on('data', (chunk) => {
            xmlData += chunk.toString();
        });

        req.on('end', async () => {
            logService.log('info', '接收的原始 XML 数据:', { xmlData });

            if (!xmlData) {
                logService.log('error', '接收到的 XML 数据为空');
                res.status(400).send('Bad Request: No XML Data');
                return;
            }

            parseString(xmlData, (err, result) => {
                if (err) {
                    logService.log('error', '解析 XML 失败:', { error: err });
                    res.status(500).send('Internal Server Error');
                    return;
                }

                const message = result.xml;
                const responseMessage = this.createResponseMessage(message);

                // 定义文件存储路径和名称
                const timestamp = new Date();
                const dateStr = timestamp.toISOString().split('T')[0].replace(/-/g, '');
                const hourStr = timestamp.getHours().toString().padStart(2, '0');
                const dirPath = path.join(__dirname, '../../data', dateStr);
                const filePath = path.join(dirPath, `${dateStr}-${hourStr}.log`);

                if (!fs.existsSync(dirPath)) {
                    logService.log('info', '目录不存在，创建目录:', { dirPath });
                    fs.mkdirSync(dirPath, { recursive: true });
                }

                // 日志条目
                const logEntry = {
                    timestamp: timestamp.toISOString(),
                    request: message,
                    response: responseMessage
                };

                //logService.log('info', '日志条目:', { logEntry });

                try {
                    fs.appendFileSync(filePath, JSON.stringify(logEntry) + '\n');
                    logService.log('info', '日志条目写入文件成功:', { filePath });
                } catch (writeErr) {
                    logService.log('error', '将日志条目写入文件失败:', { error: writeErr });
                }

                res.set('Content-Type', 'application/xml');
                res.send(responseMessage);
            });
        });

        /*logService.log('info', '收到的请求信息', {
            method: req.method,
            headers: req.headers,
            contentType: req.headers['content-type'],
            body: req.body,
        });*/
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
            logService.log('error', '生成新密钥失败:', { error: err });
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
            logService.log('error', '获取当前密钥失败:', { error: err });
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
            logService.log('error', '获取加密配置失败:', { error: err });
            res.status(500).json({
                success: false,
                error: err.message
            });
        }
    }

    async verifyServer(req, res) {
        try {
            const { signature, timestamp, nonce, echostr } = req.query;
            const token = config.wx.token;
            const shasum = crypto.createHash('sha1');
            const str = [token, timestamp, nonce].sort().join('');
            shasum.update(str);
            const shaResult = shasum.digest('hex');

            logService.log('info', '验证服务器请求', {
                signature,
                shaResult,
                timestamp,
                nonce
            });

            if (shaResult === signature) {
                logService.log('info', '验证成功: 返回 echostr', { echostr });
                res.send(echostr);
            } else {
                logService.log('error', '验证失败: 签名不匹配', {
                    signature,
                    shaResult
                });
                res.status(401).send('Unauthorized');
            }
        } catch (err) {
            logService.log('error', '验证过程出错', { error: err.message });
            res.status(500).send('Internal Server Error');
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
            logService.log('error', '获取access_token失败:', { error: err });
            res.status(500).json({
                success: false,
                error: err.message
            });
        }
    }
}

module.exports = new WxController(); 