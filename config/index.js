module.exports = {
    port: process.env.PORT || 3001,
    wx: {
        token: process.env.WX_TOKEN || 'jreadstone',
        appId: process.env.WX_APP_ID || 'wx48b2ac18dd335577',
        appSecret: process.env.WX_APP_SECRET || 'e5696fcc81de010684ac939c538031f7',
        // 加密模式：plain(明文), compatible(明文+密文), cipher(仅密文)
        encryptMode: process.env.WX_ENCRYPT_MODE || 'plain',
        // 其他微信相关配置
    }
}; 