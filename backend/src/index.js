/* eslint-disable no-console */
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { testConnection } = require('./models/db');
const errorMiddleware = require('./middleware/error');
const authRoutes = require('./routes/auth');
const communitiesRoutes = require('./routes/communities');
const ownersRoutes = require('./routes/owners');
const votesRoutes = require('./routes/votes');
const logsRoutes = require('./routes/logs');
const smsRoutes = require('./routes/sms');

const app = express();
const PORT = process.env.PORT || 8081;

// CORS 配置
const corsOptions = {
  origin: function (origin, callback) {
    const frontendUrl = process.env.FRONTEND_URL;
    const isDev = process.env.NODE_ENV !== 'production';

    // 基础允许列表
    const allowedOrigins = [
      'http://localhost:8080',
      'https://voting-frontend-n2p2.onrender.com',
      frontendUrl,
    ].filter(Boolean);

    // 1. 允许无 origin (Postman/Curl) 或 在显式白名单中
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // 2. 开发环境下允许本地 IP (移动端测试)
    if (isDev && origin.match(/^http:\/\/(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/)) {
      return callback(null, true);
    }

    // 3. 只有在未配置 FRONTEND_URL 且非生产环境时，才回退到允许所有 Render/Vercel 域名
    // 生产环境必须显式指定 FRONTEND_URL 或使用上述硬编码白名单
    if (!frontendUrl && !isDev && (origin.endsWith('.onrender.com') || origin.endsWith('.vercel.app'))) {
      return callback(null, true);
    }

    callback(new Error('Not allowed by CORS'));
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
app.use('/api/sms', smsRoutes);

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 处理
app.use((req, res) => {
  res.status(404).json({ error: '接口不存在' });
});

// 错误处理
app.use(errorMiddleware);

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
