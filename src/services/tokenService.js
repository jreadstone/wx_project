const axios = require('axios');
const fs = require('fs');
const path = require('path');
const config = require('../../config');
const logService = require('./logService');

class TokenService {
    constructor() {
        this.tokenFilePath = path.join(__dirname, '../../data/access_token.json');
    }

    async getAccessToken() {
        try {
            const tokenData = await this.readTokenFromFile();
            if (tokenData && tokenData.expires_at > Date.now()) {
                return tokenData;
            } else {
                return await this.refreshToken();
            }
        } catch (err) {
            await logService.log('token_error', '获取access_token失败', { error: err.message });
            throw err;
        }
    }

    async refreshToken() {
        try {
            const response = await axios.get(`https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${config.wx.appId}&secret=${config.wx.appSecret}`);
            const tokenData = {
                access_token: response.data.access_token,
                expires_in: response.data.expires_in,
                expires_at: Date.now() + (response.data.expires_in * 1000)
            };
            await this.saveTokenToFile(tokenData);
            return tokenData;
        } catch (err) {
            await logService.log('token_error', '刷新access_token失败', { error: err.message });
            throw err;
        }
    }

    async readTokenFromFile() {
        try {
            if (fs.existsSync(this.tokenFilePath)) {
                const tokenData = JSON.parse(fs.readFileSync(this.tokenFilePath, 'utf-8'));
                return tokenData;
            } else {
                return null;
            }
        } catch (err) {
            await logService.log('token_error', '读取access_token文件失败', { error: err.message });
            throw err;
        }
    }

    async saveTokenToFile(tokenData) {
        try {
            fs.writeFileSync(this.tokenFilePath, JSON.stringify(tokenData), 'utf-8');
        } catch (err) {
            await logService.log('token_error', '保存access_token到文件失败', { error: err.message });
            throw err;
        }
    }
}

module.exports = new TokenService(); 