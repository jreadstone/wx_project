const xml2js = require('xml2js');
const axios = require('axios');
const messageModel = require('../models/messageModel');
const tokenService = require('./tokenService');
const encryptionService = require('./encryptionService');
const config = require('../../config');
const crypto = require('crypto');

class WxService {
    constructor() {
        this.baseUrl = 'https://api.weixin.qq.com/cgi-bin';
    }

    async makeRequest(method, url, data = null) {
        try {
            const token = await tokenService.getAccessToken();
            const fullUrl = `${this.baseUrl}${url}?access_token=${token}`;
            
            const response = await axios({
                method,
                url: fullUrl,
                data
            });

            // 检查是否token失效
            if (response.data.errcode === 40013 || response.data.errcode === 40001) {
                // token失效，刷新token并重试
                const newToken = await tokenService.refreshToken();
                const retryUrl = `${this.baseUrl}${url}?access_token=${newToken}`;
                
                return axios({
                    method,
                    url: retryUrl,
                    data
                });
            }

            return response;
        } catch (error) {
            console.error('API请求失败：', error);
            throw error;
        }
    }

    async parseXmlMessage(rawData) {
        const result = await new Promise((resolve, reject) => {
            xml2js.parseString(rawData, {trim: true}, (err, result) => {
                if (err) reject(err);
                else resolve(result);
            });
        });

        // 如果是加密消息，先解密
        if (result.xml.Encrypt) {
            const decrypted = await encryptionService.decrypt(result.xml.Encrypt[0]);
            // 解析解密后的XML
            return new Promise((resolve, reject) => {
                xml2js.parseString(decrypted.message, {trim: true}, (err, result) => {
                    if (err) reject(err);
                    else resolve(result);
                });
            });
        }

        return result;
    }

    async createReplyMessage(fromUser, toUser, content = '接收成功') {
        const replyMessage = {
            xml: {
                ToUserName: [fromUser],
                FromUserName: [toUser],
                CreateTime: [new Date().getTime()],
                MsgType: ['text'],
                Content: [content]
            }
        };

        // 根据加密模式处理消息
        switch (config.wx.encryptMode) {
            case 'cipher':
                // 仅密文模式
                const encrypted = await encryptionService.encrypt(
                    await this.buildXmlReply(replyMessage),
                    config.wx.appId
                );
                return {
                    xml: {
                        Encrypt: [encrypted],
                        MsgSignature: [this.generateSignature(encrypted)],
                        TimeStamp: [Date.now()],
                        Nonce: [Math.random().toString(36).substr(2, 15)]
                    }
                };
            
            case 'compatible':
                // 明文+密文模式
                const encryptedCompat = await encryptionService.encrypt(
                    await this.buildXmlReply(replyMessage),
                    config.wx.appId
                );
                return {
                    xml: {
                        ...replyMessage.xml,
                        Encrypt: [encryptedCompat],
                        MsgSignature: [this.generateSignature(encryptedCompat)],
                        TimeStamp: [Date.now()],
                        Nonce: [Math.random().toString(36).substr(2, 15)]
                    }
                };
            
            default:
                // 明文模式
                return replyMessage;
        }
    }

    generateSignature(encrypted) {
        const timestamp = Date.now();
        const nonce = Math.random().toString(36).substr(2, 15);
        const arr = [config.wx.token, timestamp, nonce, encrypted].sort();
        const str = arr.join('');
        return crypto.createHash('sha1').update(str).digest('hex');
    }

    async buildXmlReply(replyMessage) {
        const builder = new xml2js.Builder();
        return builder.buildObject(replyMessage);
    }

    saveMessage(message) {
        messageModel.addMessage(message);
    }

    getMessageHistory() {
        return messageModel.getHistory();
    }

    async createMenu(menuConfig) {
        return this.makeRequest('POST', '/menu/create', menuConfig);
    }
}

module.exports = new WxService(); 