# 业主大会投票管理系统 - 前端

基于 Next.js 16 + React 19 + TypeScript 构建的现代化前端应用。

## 技术栈

- **框架**: Next.js 16.1.1 (App Router)
- **UI 库**: React 19.2.3
- **语言**: TypeScript 5
- **样式**: TailwindCSS 4 + PostCSS
- **图标**: lucide-react
- **图表**: Recharts 3.6.0
- **HTTP 客户端**: Axios 1.13.2
- **工具库**: clsx, tailwind-merge
- **测试**: Jest 29 + React Testing Library 16

## 快速开始

```bash
# 安装依赖
npm install

# 开发模式启动（端口 8080）
npm run dev

# 构建生产版本
npm run build

# 生产模式启动（默认端口 3000，可通过 PORT 环境变量覆盖）
npm start

# 本地生产模式使用 8080 端口
PORT=8080 npm start

# 运行测试
npm test

# 运行测试（监听模式）
npm run test:watch

# 运行测试（覆盖率报告）
npm run test:coverage

# 代码检查
npm run lint
```

## 目录结构

```
frontend/
├── src/
│   ├── app/                    # Next.js App Router 页面
│   │   ├── layout.tsx          # 根布局
│   │   ├── page.tsx            # 首页（重定向到登录）
│   │   ├── login/              # 登录页面
│   │   └── dashboard/          # 仪表板
│   │       ├── layout.tsx      # 仪表板布局
│   │       ├── page.tsx        # 主页统计
│   │       ├── communities/    # 小区管理
│   │       ├── owners/         # 业主管理
│   │       ├── votes/          # 投票管理
│   │       └── settings/       # 系统设置
│   ├── components/             # 可复用组件
│   │   ├── StatsCard.tsx       # 统计卡片
│   │   ├── DataTable.tsx       # 数据表格
│   │   ├── Sidebar.tsx         # 侧边导航栏
│   │   ├── BuildingVoteVisualization/  # 楼栋投票可视化
│   │   └── SweepStatusVisualization/   # 扫楼状态可视化
│   ├── contexts/               # React Context
│   │   └── AuthContext.tsx     # 认证上下文
│   └── lib/                    # 工具函数
│       ├── api.ts              # API 客户端封装
│       └── utils.ts            # 通用工具函数
├── public/                     # 静态资源
├── package.json
├── tsconfig.json
├── next.config.ts
├── jest.config.js
└── postcss.config.mjs
```

## 环境变量

创建 `.env.local` 文件配置 API 地址：

```env
NEXT_PUBLIC_API_URL=http://localhost:8081/api
```

## 功能模块

- **登录认证**: JWT 身份验证
- **仪表板**: 投票统计数据可视化
- **小区管理**: 小区和期数的 CRUD 操作
- **业主管理**: 业主信息管理，支持 Excel 导入
- **投票管理**: 多轮投票状态追踪和统计
- **扫楼管理**: 扫楼进度追踪
- **系统设置**: 用户管理和操作日志
