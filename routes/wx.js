const express = require('express');
const router = express.Router();
const xml2js = require('xml2js');

// 用于存储消息历史
const messageHistory = [];

// 处理微信服务器的消息推送
router.post('/', (req, res) => {
  let rawData = '';
  req.on('data', chunk => {
    rawData += chunk;
  });
  
  req.on('end', () => {
    // 解析微信发来的XML消息
    xml2js.parseString(rawData, {trim: true}, (err, result) => {
      if (err) {
        console.error('解析XML失败:', err);
        res.send('success');
        return;
      }

      const message = {
        type: 'received',
        timestamp: new Date().toISOString(),
        content: result.xml,
        raw: rawData
      };

      // 保存消息历史
      messageHistory.push(message);

      // 构建回复消息
      const replyMessage = {
        xml: {
          ToUserName: result.xml.FromUserName[0],
          FromUserName: result.xml.ToUserName[0], 
          CreateTime: new Date().getTime(),
          MsgType: ['text'],
          Content: ['接收成功']
        }
      };

      // 将回复消息转换为XML
      const builder = new xml2js.Builder();
      const replyXml = builder.buildObject(replyMessage);

      // 保存回复消息到历史
      messageHistory.push({
        type: 'reply',
        timestamp: new Date().toISOString(),
        content: replyMessage,
        raw: replyXml
      });

      res.type('application/xml');
      res.send(replyXml);
    });
  });
});

// 获取消息历史的接口
router.get('/history', (req, res) => {
  res.json(messageHistory);
});

module.exports = router; 