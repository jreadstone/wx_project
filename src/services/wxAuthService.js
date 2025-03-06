const crypto = require('crypto');
const config = require('../../config');
const logService = require('./logService');

class WxAuthService {
    async verifySignature(signature, timestamp, nonce) {
        try {
            // 记录验证参数
            await logService.log('auth_params', '验证参数', {
                token: config.wx.token,
                timestamp,
                nonce,
                signature
            });

            // 1. 将token、timestamp、nonce三个参数进行字典序排序
            const arr = [config.wx.token, timestamp, nonce].sort();
            
            // 记录排序后的数组
            await logService.log('auth_sort', '排序结果', { sortedArray: arr });

            // 2. 将三个参数字符串拼接成一个字符串
            const str = arr.join('');
            await logService.log('auth_string', '拼接字符串', { string: str });

            // 3. 进行sha1加密
            const sha1 = crypto.createHash('sha1');
            const hashCode = sha1.update(str).digest('hex');
            
            // 记录加密结果和比对结果
            await logService.log('auth_compare', '签名比对', {
                calculated: hashCode,
                received: signature,
                matched: hashCode === signature
            });

            return hashCode === signature;
        } catch (err) {
            await logService.log('auth_error', '验证签名失败', { error: err.message });
            return false;
        }
    }
}

module.exports = new WxAuthService(); 