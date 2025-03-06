const express = require('express');
const path = require('path');
const config = require('./config');
const wxRouter = require('./src/routes/wxRoute');

const app = express();
const port = config.port;

// 中间件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 配置静态文件访问
app.use(express.static('public'));
app.use('/files', express.static(path.join(__dirname, 'files')));

// 微信相关路由
app.use('/wx', wxRouter);

// 主页路由
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 启动服务器
app.listen(port, () => {
  console.log(`服务器运行在 http://localhost:${port}`);
}); 