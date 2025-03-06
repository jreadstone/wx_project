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

        const logText = JSON.stringify(logEntry, null, 2);

        try {
            await fs.mkdir(path.dirname(this.logPath), { recursive: true });
            await fs.appendFile(
                this.logPath,
                logText + '\n' + '-'.repeat(80) + '\n',
                'utf8'
            );

            // 同时在控制台输出
            console.log('\n[WX_LOG]', message);
            console.log(logText);
        } catch (err) {
            console.error('写入日志失败:', err);
        }
    }
}

module.exports = new LogService(); 