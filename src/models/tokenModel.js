const fs = require('fs').promises;
const path = require('path');

class TokenModel {
    constructor() {
        this.token = null;
        this.expiresAt = null;
        this.filePath = path.join(__dirname, '../../data/token.json');
        this.initialized = false;
    }

    async init() {
        if (this.initialized) return;
        
        try {
            // 确保数据目录存在
            await fs.mkdir(path.dirname(this.filePath), { recursive: true });
            
            // 尝试读取存储的token信息
            try {
                const data = await fs.readFile(this.filePath, 'utf8');
                const tokenData = JSON.parse(data);
                this.token = tokenData.token;
                this.expiresAt = tokenData.expiresAt;
            } catch (err) {
                // 如果文件不存在或解析失败，使用默认值
                this.token = null;
                this.expiresAt = null;
            }
            
            this.initialized = true;
        } catch (err) {
            console.error('初始化token存储失败:', err);
            throw err;
        }
    }

    async setToken(token, expiresIn) {
        await this.init();
        
        this.token = token;
        // 设置过期时间，预留5分钟的缓冲时间
        this.expiresAt = Date.now() + (expiresIn - 300) * 1000;

        // 持久化到文件
        try {
            await fs.writeFile(
                this.filePath,
                JSON.stringify({
                    token: this.token,
                    expiresAt: this.expiresAt
                }, null, 2),
                'utf8'
            );
        } catch (err) {
            console.error('保存token失败:', err);
            throw err;
        }
    }

    async getToken() {
        await this.init();
        
        if (!this.token || !this.isValid()) {
            return null;
        }
        return this.token;
    }

    isValid() {
        return this.expiresAt && Date.now() < this.expiresAt;
    }

    async clear() {
        await this.init();
        
        this.token = null;
        this.expiresAt = null;

        try {
            await fs.writeFile(
                this.filePath,
                JSON.stringify({
                    token: null,
                    expiresAt: null
                }, null, 2),
                'utf8'
            );
        } catch (err) {
            console.error('清除token失败:', err);
            throw err;
        }
    }
}

module.exports = new TokenModel(); 