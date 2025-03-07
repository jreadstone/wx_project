const fs = require('fs');
const path = require('path');

class LogService {
    constructor() {
        this.logDir = path.join(__dirname, '../../logs');
        // 确保日志目录存在
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }

    /**
     * 记录日志
     * @param {string} type 日志类型 (info, warn, error)
     * @param {string} message 日志消息
     * @param {object} data 附加数据
     */
    log(type, message, data = {}) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            type,
            message,
            data
        };

        // 控制台输出日志
        console[type === 'error' ? 'error' : type === 'warn' ? 'warn' : 'log'](
            `[${timestamp}] [${type.toUpperCase()}] ${message}`,
            data
        );

        // 异步写入日志文件，不阻塞主线程
        setImmediate(() => {
            try {
                const logFile = path.join(this.logDir, 'wx.log');
                fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');
            } catch (err) {
                console.error(`[${new Date().toISOString()}] [ERROR] 写入日志文件失败:`, err);
            }
        });
    }

    /**
     * 异步保存消息日志到数据目录
     * @param {object} message 请求消息
     * @param {string} responseMessage 响应消息
     * @param {string} note 可选的附加说明
     */
    saveMessageLog(message, responseMessage, note = null) {
        // 异步执行，不阻塞主线程
        setImmediate(() => {
            try {
                const timestamp = new Date();
                const dateStr = timestamp.toISOString().split('T')[0].replace(/-/g, '');
                const hourStr = timestamp.getHours().toString().padStart(2, '0');
                const dirPath = path.join(__dirname, '../../data', dateStr);
                const filePath = path.join(dirPath, `${dateStr}-${hourStr}.log`);

                if (!fs.existsSync(dirPath)) {
                    fs.mkdirSync(dirPath, { recursive: true });
                }

                // 日志条目
                const logEntry = {
                    timestamp: timestamp.toISOString(),
                    request: message,
                    response: responseMessage
                };

                // 如果有附加说明，添加到日志条目中
                if (note) {
                    logEntry.note = note;
                }

                fs.appendFileSync(filePath, JSON.stringify(logEntry) + '\n');
                this.log('info', '消息日志写入成功', { filePath });
            } catch (err) {
                this.log('error', '保存消息日志失败', { error: err.message, stack: err.stack });
            }
        });
    }

    /**
     * 异步保存错误日志到数据目录
     * @param {object} message 请求消息
     * @param {Error} error 错误对象
     * @param {string} responseMessage 响应消息
     */
    saveErrorLog(message, error, responseMessage) {
        setImmediate(() => {
            try {
                const timestamp = new Date();
                const dateStr = timestamp.toISOString().split('T')[0].replace(/-/g, '');
                const hourStr = timestamp.getHours().toString().padStart(2, '0');
                const dirPath = path.join(__dirname, '../../data', dateStr);
                const filePath = path.join(dirPath, `${dateStr}-${hourStr}.log`);

                if (!fs.existsSync(dirPath)) {
                    fs.mkdirSync(dirPath, { recursive: true });
                }

                const logEntry = {
                    timestamp: timestamp.toISOString(),
                    request: message,
                    error: {
                        message: error.message,
                        stack: error.stack
                    },
                    response: responseMessage
                };

                fs.appendFileSync(filePath, JSON.stringify(logEntry) + '\n');
                this.log('info', '错误日志写入成功', { filePath });
            } catch (err) {
                this.log('error', '保存错误日志失败', { error: err.message, stack: err.stack });
            }
        });
    }
}

module.exports = new LogService(); 