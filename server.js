const express = require('express');
const path = require('path');

const app = express();
const PORT = 3003;

// 静态文件服务
app.use(express.static(path.join(__dirname)));

// 首页路由
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🎮 坦克大战服务器已启动！`);
    console.log(`📍 访问地址: http://localhost:${PORT}`);
    console.log(`⏹️  按 Ctrl+C 停止服务器`);
});
