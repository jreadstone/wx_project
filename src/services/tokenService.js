const axios = require('axios');
const config = require('../../config');
const tokenModel = require('../models/tokenModel');

class TokenService {
    async getAccessToken() {
        // 先检查现有token是否有效
        const existingToken = await tokenModel.getToken();
        if (existingToken) {
            return existingToken;
        }

        try {
            const response = await axios.get('https://api.weixin.qq.com/cgi-bin/token', {
                params: {
                    grant_type: 'client_credential',
                    appid: config.wx.appId,
                    secret: config.wx.appSecret
                }
            });

            if (response.data.access_token) {
                await tokenModel.setToken(response.data.access_token, response.data.expires_in);
                return response.data.access_token;
            } else {
                throw new Error('获取access_token失败：' + JSON.stringify(response.data));
            }
        } catch (error) {
            console.error('获取access_token出错：', error);
            throw error;
        }
    }

    async refreshToken() {
        await tokenModel.clear();
        return this.getAccessToken();
    }
}

module.exports = new TokenService(); 