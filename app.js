const express = require('express');
const path = require('path');
const config = require('./config');
const wxRouter = require('./src/routes/wxRoute');

const app = express();
const port = config.port;

// 中间件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 微信验证接口（必须放在最前面）
app.get('/', wxRouter);
app.post('/', wxRouter);

// 其他微信相关路由
app.use('/encryption', wxRouter);
app.use('/access_token', wxRouter);
app.use('/history', wxRouter);

// 静态文件服务
app.use('/static', express.static('public'));
app.use('/files', express.static(path.join(__dirname, 'files')));
// 页面路由放在最后
app.get('/index', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

// 启动服务器
app.listen(port, () => {
  console.log(`服务器运行在 http://localhost:${port}`);
}); 