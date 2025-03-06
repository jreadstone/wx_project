const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const config = require('../../config');
const logService = require('./logService');

class TokenService {
    constructor() {
        this.tokenFilePath = path.join(__dirname, '../../data/access_token.json');
    }

    async getAccessToken() {
        try {
            // 先尝试从文件读取
            try {
                const data = await fs.readFile(this.tokenFilePath, 'utf8');
                const tokenData = JSON.parse(data);
                
                // 检查token是否过期（预留5分钟缓冲）
                if (tokenData.expiresAt && tokenData.expiresAt > Date.now() + 300000) {
                    return {
                        access_token: tokenData.access_token,
                        expires_in: Math.floor((tokenData.expiresAt - Date.now()) / 1000)
                    };
                }
            } catch (err) {
                // 文件不存在或解析失败，继续获取新token
            }

            // 从微信服务器获取新token
            const response = await axios.get('https://api.weixin.qq.com/cgi-bin/token', {
                params: {
                    grant_type: 'client_credential',
                    appid: config.wx.appId,
                    secret: config.wx.appSecret
                }
            });

            if (response.data.access_token) {
                // 保存到文件
                await this.saveToken(response.data.access_token, response.data.expires_in);
                return response.data;
            } else {
                throw new Error('获取access_token失败：' + JSON.stringify(response.data));
            }
        } catch (error) {
            await logService.log('token_error', '获取access_token失败', { error: error.message });
            throw error;
        }
    }

    async saveToken(access_token, expires_in) {
        const tokenData = {
            access_token,
            expiresAt: Date.now() + (expires_in * 1000)
        };

        await fs.mkdir(path.dirname(this.tokenFilePath), { recursive: true });
        await fs.writeFile(
            this.tokenFilePath,
            JSON.stringify(tokenData, null, 2),
            'utf8'
        );
    }
}

module.exports = new TokenService(); 