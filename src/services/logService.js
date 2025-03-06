const fs = require('fs').promises;
const path = require('path');

class LogService {
    constructor() {
        this.logPath = path.join(__dirname, '../../logs/wx.log');
    }

    async log(type, message, data = {}) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            type,
            message,
            data
        };

        try {
            await fs.mkdir(path.dirname(this.logPath), { recursive: true });
            await fs.appendFile(
                this.logPath,
                JSON.stringify(logEntry) + '\n',
                'utf8'
            );
        } catch (err) {
            console.error('写入日志失败:', err);
        }
    }
}

module.exports = new LogService(); 