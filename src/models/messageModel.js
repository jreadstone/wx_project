// 消息历史存储模型
class MessageModel {
    constructor() {
        this.messageHistory = [];
    }

    addMessage(message) {
        this.messageHistory.push(message);
    }

    getHistory() {
        return this.messageHistory;
    }
}

module.exports = new MessageModel(); 