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
const axios = require('axios');

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

            try {
                // 使用 Promise 包装 parseString 以便使用 async/await
                const parseXml = (xmlData) => {
                    return new Promise((resolve, reject) => {
                        parseString(xmlData, (err, result) => {
                            if (err) reject(err);
                            else resolve(result);
                        });
                    });
                };

                const result = await parseXml(xmlData);
                const message = result.xml;
                
                // 先获取响应消息，确保 OpenAI 调用完成
                const responseMessage = await this.createResponseMessage(message);
                
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

                // 日志条目 - 现在包含完整的响应消息
                const logEntry = {
                    timestamp: timestamp.toISOString(),
                    request: message,
                    response: responseMessage
                };

                /*logService.log('info', '准备写入日志条目:', { 
                    filePath,
                    hasResponse: !!responseMessage
                });*/

                try {
                    fs.appendFileSync(filePath, JSON.stringify(logEntry) + '\n');
                    //logService.log('info', '日志条目写入文件成功:', { filePath });
                } catch (writeErr) {
                    logService.log('error', '将日志条目写入文件失败:', { error: writeErr });
                }

                // 设置响应头并发送响应
                res.set('Content-Type', 'application/xml');
                res.send(responseMessage);
                
            } catch (err) {
                logService.log('error', '处理消息时发生错误:', { error: err.message, stack: err.stack });
                res.status(500).send('Internal Server Error');
            }
        });
    }

    async createResponseMessage(message) {
        const toUser = message.FromUserName[0];
        const fromUser = message.ToUserName[0];
        const openaiEndpoint = 'https://api.vveai.com/v1/chat/completions';
        const defaultMessage = '你发送的消息已经收到，稍后将进行处理。';
        const apiKey = 'sk-5AnmeYSzESU6VfgHC98590FeA2Ef412898B013523887E44a';
        
        // 获取用户消息内容
        const userContent = message.Content[0];
        
        // 记录用户发送的消息内容
        logService.log('info', '准备处理用户消息:', { 
            content: userContent,
            fromUser: toUser,
            toUser: fromUser
        });

        // 根据消息内容选择模型
        const needsSearch = userContent.includes('联网') || userContent.includes('在线');
        const modelName = needsSearch ? 'deepseek-r1-search' : 'deepseek-reasoner';
        
        logService.log('info', `根据消息内容选择模型: ${modelName}`, { 
            needsSearch,
            keywords: needsSearch ? '包含"联网"或"在线"关键词' : '不包含特定关键词'
        });

        try {
            // 记录准备发送到OpenAI的请求数据
            const requestData = {
                model: modelName,
                messages: [
                    { role: 'user', content: userContent }
                ],
                max_tokens: 8000,
                temperature: 0.3,
                stream: false
            };
            
            // 记录发送请求的时间
            const startTime = Date.now();
            logService.log('info', '开始调用OpenAI接口', { 
                timestamp: new Date().toISOString(),
                model: modelName
            });
            
            // 调用OpenAI接口处理消息内容
            const openaiResponse = await axios.post(openaiEndpoint, requestData, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json' 
                },
                timeout: 300000 // 设置超时时间为300秒
            });
            
            // 记录响应时间
            const endTime = Date.now();
            logService.log('info', 'OpenAI接口调用完成', { 
                elapsedTime: `${endTime - startTime}ms`,
                timestamp: new Date().toISOString(),
                status: openaiResponse.status,
                statusText: openaiResponse.statusText,
                model: modelName
            });

            // 记录OpenAI的响应数据
            logService.log('info', 'OpenAI响应数据:', { 
                data: openaiResponse.data,
                headers: openaiResponse.headers
            });

            // 检查响应数据结构
            if (!openaiResponse.data) {
                logService.log('error', 'OpenAI响应数据为空');
                return this.createDefaultResponse(toUser, fromUser, defaultMessage);
            }

            if (!openaiResponse.data.choices || !openaiResponse.data.choices.length) {
                logService.log('error', 'OpenAI响应数据中没有choices字段或为空数组', { 
                    data: openaiResponse.data 
                });
                return this.createDefaultResponse(toUser, fromUser, defaultMessage);
            }

            if (!openaiResponse.data.choices[0].message) {
                logService.log('error', 'OpenAI响应数据中没有message字段', { 
                    choice: openaiResponse.data.choices[0] 
                });
                return this.createDefaultResponse(toUser, fromUser, defaultMessage);
            }

            // 处理OpenAI的响应内容
            const content = openaiResponse.data.choices[0].message.content || defaultMessage;
            logService.log('info', '最终处理的响应内容:', { 
                content,
                model: modelName
            });
            
            // 构建XML响应
            const xmlResponse = `
                <xml>
                    <ToUserName><![CDATA[${toUser}]]></ToUserName>
                    <FromUserName><![CDATA[${fromUser}]]></FromUserName>
                    <CreateTime>${Math.floor(Date.now() / 1000)}</CreateTime>
                    <MsgType><![CDATA[text]]></MsgType>
                    <Content><![CDATA[${content}]]></Content>
                </xml>
            `;
            
            return xmlResponse;
        } catch (error) {
            // 详细记录错误信息
            logService.log('error', `调用OpenAI接口(${modelName})失败:`, { 
                message: error.message,
                stack: error.stack,
                code: error.code,
                response: error.response ? {
                    status: error.response.status,
                    statusText: error.response.statusText,
                    data: error.response.data
                } : 'No response'
            });
            
            return this.createDefaultResponse(toUser, fromUser, defaultMessage);
        }
    }

    // 辅助方法：创建默认响应
    createDefaultResponse(toUser, fromUser, content) {
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