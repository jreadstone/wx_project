const crypto = require('crypto');
const config = require('../../config');
const encryptionModel = require('../models/encryptionModel');

class EncryptionService {
    constructor() {
        this.iv = null;
        this.key = null;
        this.initialized = false;
    }

    async init() {
        if (this.initialized) return;
        
        const encodingAESKey = await encryptionModel.getEncodingAESKey();
        // 将EncodingAESKey转换为Buffer
        const aesKey = Buffer.from(encodingAESKey + '=', 'base64');
        this.key = aesKey;
        this.iv = aesKey.slice(0, 16);
        this.initialized = true;
    }

    async encrypt(message, appId) {
        await this.init();

        const randomBytes = crypto.randomBytes(16);
        const msg = Buffer.from(message);
        const msgLength = Buffer.alloc(4);
        msgLength.writeUInt32BE(msg.length, 0);
        const appIdBuffer = Buffer.from(appId);

        const raw = Buffer.concat([
            randomBytes,
            msgLength,
            msg,
            appIdBuffer
        ]);

        const cipher = crypto.createCipheriv('aes-256-cbc', this.key, this.iv);
        const encrypted = Buffer.concat([
            cipher.update(raw),
            cipher.final()
        ]);

        return encrypted.toString('base64');
    }

    async decrypt(encrypted) {
        await this.init();

        const decipher = crypto.createDecipheriv('aes-256-cbc', this.key, this.iv);
        const raw = Buffer.concat([
            decipher.update(Buffer.from(encrypted, 'base64')),
            decipher.final()
        ]);

        const msgLength = raw.readUInt32BE(16);
        const msg = raw.slice(20, 20 + msgLength);
        const appId = raw.slice(20 + msgLength);

        return {
            message: msg.toString(),
            appId: appId.toString()
        };
    }
}

module.exports = new EncryptionService(); 