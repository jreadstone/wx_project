const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class EncryptionModel {
    constructor() {
        this.encodingAESKey = null;
        this.filePath = path.join(__dirname, '../../data/encryption.json');
        this.initialized = false;
    }

    async init() {
        if (this.initialized) return;
        
        try {
            await fs.mkdir(path.dirname(this.filePath), { recursive: true });
            
            try {
                const data = await fs.readFile(this.filePath, 'utf8');
                const encryptionData = JSON.parse(data);
                this.encodingAESKey = encryptionData.encodingAESKey;
            } catch (err) {
                // 如果文件不存在或解析失败，生成新的AESKey
                this.encodingAESKey = this.generateEncodingAESKey();
                await this.saveToFile();
            }
            
            this.initialized = true;
        } catch (err) {
            console.error('初始化加密配置失败:', err);
            throw err;
        }
    }

    generateEncodingAESKey() {
        // 生成43位字符串，包含a-z,A-Z,0-9
        return crypto.randomBytes(32)
            .toString('base64')
            .replace(/[^a-zA-Z0-9]/g, '')
            .slice(0, 43);
    }

    async saveToFile() {
        try {
            await fs.writeFile(
                this.filePath,
                JSON.stringify({
                    encodingAESKey: this.encodingAESKey
                }, null, 2),
                'utf8'
            );
        } catch (err) {
            console.error('保存加密配置失败:', err);
            throw err;
        }
    }

    async getEncodingAESKey() {
        await this.init();
        return this.encodingAESKey;
    }

    async forceGenerateNewKey() {
        this.encodingAESKey = this.generateEncodingAESKey();
        await this.saveToFile();
        return this.encodingAESKey;
    }
}

module.exports = new EncryptionModel(); 