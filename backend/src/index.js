const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { testConnection } = require('./models/db');
const authRoutes = require('./routes/auth');
const communitiesRoutes = require('./routes/communities');
const ownersRoutes = require('./routes/owners');
const votesRoutes = require('./routes/votes');
const logsRoutes = require('./routes/logs');

const app = express();
const PORT = process.env.PORT || 3001;

// CORS 配置
const corsOptions = {
  origin: function (origin, callback) {
    // 允许的域名列表
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:8080',
      process.env.FRONTEND_URL,  // 生产环境前端 URL
    ].filter(Boolean);

    // 允许无 origin 的请求（如 Postman、curl）
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      // 生产环境也允许 Render 的域名
      if (origin && (origin.endsWith('.onrender.com') || origin.endsWith('.vercel.app'))) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

// 中间件
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 请求日志
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

// 路由
app.use('/api/auth', authRoutes);
app.use('/api/communities', communitiesRoutes);
app.use('/api/owners', ownersRoutes);
app.use('/api/votes', votesRoutes);
app.use('/api/logs', logsRoutes);

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 处理
app.use((req, res) => {
  res.status(404).json({ error: '接口不存在' });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({ error: '服务器内部错误' });
});

// 启动服务器
async function start() {
  // 测试数据库连接
  const dbConnected = await testConnection();
  if (!dbConnected) {
    console.error('无法连接数据库，请检查配置');
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
    console.log('API 端点:');
    console.log('  POST /api/auth/login - 登录');
    console.log('  GET  /api/auth/me - 获取当前用户');
    console.log('  GET  /api/communities - 小区列表');
    console.log('  GET  /api/owners - 业主列表');
    console.log('  GET  /api/votes/rounds - 投票轮次');
    console.log('  GET  /api/votes/stats - 投票统计');
  });
}

// 导出 app 用于测试
module.exports = { app };

// 仅在直接运行时启动服务器
if (require.main === module) {
  start();
}
