const crypto = require('crypto');
const config = require('../../config');

class WxAuthService {
    verifySignature(signature, timestamp, nonce) {
        try {
            // 1. 将token、timestamp、nonce三个参数进行字典序排序
            const arr = [config.wx.token, timestamp, nonce].sort();
            
            // 2. 将三个参数字符串拼接成一个字符串进行sha1加密
            const str = arr.join('');
            const sha1 = crypto.createHash('sha1');
            const hashCode = sha1.update(str).digest('hex');
            
            // 3. 将加密后的字符串与signature对比
            return hashCode === signature;
        } catch (err) {
            console.error('验证签名失败:', err);
            return false;
        }
    }
}

module.exports = new WxAuthService(); 