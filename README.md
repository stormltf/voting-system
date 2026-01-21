# 业主大会投票管理系统

[![CI](https://github.com/stormltf/voting-system/actions/workflows/ci.yml/badge.svg)](https://github.com/stormltf/voting-system/actions/workflows/ci.yml)
[![Docker Build](https://github.com/stormltf/voting-system/actions/workflows/docker-build.yml/badge.svg)](https://github.com/stormltf/voting-system/actions/workflows/docker-build.yml)

一个用于管理小区业主大会投票的全栈应用系统，支持多小区、多期数、多轮投票的完整管理流程。

## 目录

- [功能特性](#功能特性)
- [技术栈](#技术栈)
- [快速开始](#快速开始)
- [Docker 部署](#docker-部署)
- [云端部署](#云端部署)
- [项目结构](#项目结构)
- [API 文档](#api-文档)
- [数据库设计](#数据库设计)
- [测试](#测试)

---

## 功能特性

### 核心功能

| 功能模块 | 说明 |
|---------|------|
| **多小区管理** | 支持多个小区的独立管理和数据隔离 |
| **层级结构** | 小区 → 期数 → 楼栋 → 业主 的完整层级 |
| **业主管理** | CRUD 操作 + Excel 批量导入 |
| **多轮投票** | 支持创建多个投票轮次，独立统计 |
| **投票追踪** | 5 种状态：未投票 / 已投票 / 拒绝 / 现场 / 视频 |
| **扫楼管理** | 4 种状态：待扫楼 / 已联系 / 已完成 / 无法联系 |
| **双维度统计** | 按户数统计 + 按面积加权统计 |
| **数据可视化** | 楼层平面图 + 统计图表 |

### 用户权限

| 角色 | 权限范围 |
|------|---------|
| `super_admin` | 管理所有小区和用户 |
| `community_admin` | 管理本小区数据 |
| `community_user` | 仅查看本小区数据 |

---

## 技术栈

| 层级 | 技术 |
|------|------|
| **前端** | Next.js 16 · React 19 · TypeScript · TailwindCSS 4 · Recharts |
| **后端** | Express.js · Node.js · JWT · ExcelJS |
| **数据库** | MySQL 8.0 / TiDB Cloud |
| **部署** | Docker · Render · GitHub Actions |
| **测试** | Jest · React Testing Library · Supertest |

---

## 快速开始

### 环境要求

- Node.js v18+
- MySQL 8.0+
- npm 或 yarn

### 1. 克隆项目

```bash
git clone https://github.com/stormltf/voting-system.git
cd voting-system
```

### 2. 初始化数据库

```bash
mysql -u root -p < database/schema.sql
```

### 3. 启动后端

```bash
cd backend
cp .env.example .env
# 编辑 .env 配置数据库连接
npm install && npm run dev
```

<details>
<summary>后端环境变量配置</summary>

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=voting_system
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d
PORT=8081
```
</details>

### 4. 启动前端

```bash
cd frontend
npm install && npm run dev
```

### 5. 访问系统

| 服务 | 地址 |
|------|------|
| 前端 | http://localhost:8080 |
| 后端 API | http://localhost:8081 |

**默认账号**: `admin` / `admin123`

> **安全提示**: 生产环境请务必修改默认密码和 JWT_SECRET

---

## Docker 部署

### 一键启动

```bash
cp .env.docker .env
docker-compose up -d
```

### 常用命令

```bash
# 查看状态
docker-compose ps

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down

# 重新构建
docker-compose build --no-cache

# 进入数据库
docker exec -it voting-mysql mysql -uvoting -pvoting123 voting_system
```

### 服务说明

| 服务 | 镜像 | 端口 |
|------|------|------|
| mysql | mysql:8.0 | 3306 |
| backend | 自构建 | 8081 |
| frontend | 自构建 | 8080 |

---

## 云端部署

### Render + TiDB Cloud（推荐）

**在线演示**:
- 前端: https://voting-frontend-n2p2.onrender.com
- 后端: https://voting-backend-c4zo.onrender.com

### 部署步骤

1. Fork 此仓库到你的 GitHub
2. 在 [TiDB Cloud](https://tidbcloud.com) 创建 Serverless Cluster
3. 使用 `database/schema-tidb.sql` 初始化数据库
4. 在 [Render](https://render.com) 创建 Blueprint，连接 GitHub 仓库

<details>
<summary>环境变量配置</summary>

**后端**:
```env
DB_HOST=gateway01.xxx.prod.aws.tidbcloud.com
DB_PORT=4000
DB_USER=xxx
DB_PASSWORD=xxx
DB_NAME=voting_system
JWT_SECRET=your-secret-key
FRONTEND_URL=https://your-frontend.onrender.com
```

**前端**:
```env
NEXT_PUBLIC_API_URL=https://your-backend.onrender.com/api
```
</details>

<details>
<summary>TiDB 兼容性说明</summary>

| 差异项 | MySQL | TiDB |
|--------|-------|------|
| 端口 | 3306 | 4000 |
| ENUM 类型 | 支持 | 使用 VARCHAR 替代 |
| GROUP BY | 宽松模式 | 严格模式（所有非聚合列必须在 GROUP BY 中） |
| HAVING 别名 | 支持 | 不支持（使用聚合函数表达式） |
</details>

### 使用 GitHub 镜像部署

```bash
docker pull ghcr.io/stormltf/voting-system/backend:latest
docker pull ghcr.io/stormltf/voting-system/frontend:latest
```

---

## 项目结构

```
voting-system/
├── backend/                    # Express 后端服务
│   ├── src/
│   │   ├── index.js           # 应用入口
│   │   ├── routes/            # API 路由
│   │   │   ├── auth.js        # 认证（含用户管理）
│   │   │   ├── communities.js # 小区和期数
│   │   │   ├── owners.js      # 业主管理
│   │   │   ├── votes.js       # 投票和扫楼
│   │   │   └── logs.js        # 操作日志
│   │   ├── middleware/        # 中间件
│   │   ├── models/            # 数据库连接
│   │   └── utils/             # 工具函数
│   └── tests/                 # 测试文件
│
├── frontend/                   # Next.js 前端
│   ├── src/
│   │   ├── app/               # 页面路由
│   │   │   ├── login/         # 登录页
│   │   │   └── dashboard/     # 仪表板
│   │   │       ├── communities/
│   │   │       ├── owners/
│   │   │       ├── votes/
│   │   │       └── settings/
│   │   ├── components/        # 组件
│   │   ├── contexts/          # 状态管理
│   │   └── lib/               # API 客户端
│   └── tests/                 # 测试文件
│
├── database/                   # 数据库脚本
│   ├── schema.sql             # MySQL 结构
│   ├── schema-tidb.sql        # TiDB 兼容版
│   └── init/                  # Docker 初始化
│
├── .github/workflows/          # CI/CD
├── docker-compose.yml          # Docker 编排
└── render.yaml                 # Render 部署配置
```

---

## API 文档

### 认证接口

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| POST | `/api/auth/login` | 用户登录 | 公开 |
| GET | `/api/auth/me` | 获取当前用户 | 登录 |
| PUT | `/api/auth/password` | 修改密码 | 登录 |
| POST | `/api/auth/users` | 创建用户 | 管理员 |

### 小区管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/communities` | 获取小区列表 |
| POST | `/api/communities` | 创建小区 |
| GET | `/api/communities/:id` | 获取小区详情 |
| PUT | `/api/communities/:id` | 更新小区 |
| DELETE | `/api/communities/:id` | 删除小区 |
| GET | `/api/communities/:id/phases` | 获取期数列表 |
| POST | `/api/communities/:id/phases` | 创建期数 |

### 业主管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/owners` | 获取业主列表（分页、搜索、筛选） |
| POST | `/api/owners` | 创建业主 |
| PUT | `/api/owners/:id` | 更新业主 |
| DELETE | `/api/owners/:id` | 删除业主 |
| POST | `/api/owners/import` | Excel 批量导入 |
| GET | `/api/owners/buildings/:phaseId` | 获取楼栋列表 |

### 投票管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/votes/rounds` | 获取投票轮次 |
| POST | `/api/votes/rounds` | 创建轮次 |
| PUT | `/api/votes/rounds/:id` | 更新轮次 |
| DELETE | `/api/votes/rounds/:id` | 删除轮次 |
| GET | `/api/votes` | 获取投票记录 |
| POST | `/api/votes` | 创建/更新投票 |
| PUT | `/api/votes/batch` | 批量更新投票 |
| POST | `/api/votes/init` | 初始化投票记录 |
| POST | `/api/votes/import` | Excel 导入投票 |
| GET | `/api/votes/stats` | 获取统计数据 |
| PUT | `/api/votes/sweep/batch` | 批量更新扫楼 |

### 日志接口

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/logs` | 获取操作日志 | 超级管理员 |
| GET | `/api/logs/stats` | 日志统计 | 超级管理员 |

---

## 数据库设计

### ER 关系图

```
communities (小区)
    │
    └── phases (期数) 1:N
            │
            └── owners (业主) 1:N
                    │
                    └── votes (投票记录) 1:N
                            │
                            └── vote_rounds (投票轮次) N:1

users (用户) ──── communities
operation_logs (操作日志)
```

### 数据表概览

| 表名 | 说明 | 关键字段 |
|------|------|----------|
| `users` | 系统用户 | username, role, community_id |
| `communities` | 小区 | name, address |
| `phases` | 期数 | community_id, code, name |
| `owners` | 业主 | phase_id, room_number, owner_name, area |
| `vote_rounds` | 投票轮次 | community_id, year, status |
| `votes` | 投票记录 | owner_id, round_id, vote_status, sweep_status |
| `operation_logs` | 操作日志 | user_id, action, module, details |

### 状态码说明

**投票状态 (vote_status)**

| 状态 | 说明 |
|------|------|
| `pending` | 未投票（默认） |
| `voted` | 已投票 |
| `refused` | 拒绝投票 |
| `onsite` | 现场投票 |
| `video` | 视频投票 |

**扫楼状态 (sweep_status)**

| 状态 | 说明 |
|------|------|
| `pending` | 待扫楼（默认） |
| `contacted` | 已联系 |
| `completed` | 已完成 |
| `unreachable` | 无法联系 |

> 完整建表语句请查看 [`database/schema.sql`](./database/schema.sql)

---

## Excel 导入格式

业主数据导入支持以下字段：

| 列名 | 说明 | 示例 |
|------|------|------|
| 序号 | 业主序号 | 1 |
| 房间号 | 楼栋-单元-房号 | 01-01-0101 |
| 姓名 | 业主姓名 | 张三 |
| 面积 | 房屋面积（m²） | 89.5 |
| 车位号 | 车位编号 | B-001 |
| 车位面积 | 车位面积（m²） | 12.5 |
| 联系电话1/2/3 | 联系方式 | 13800138000 |
| 群状态 | 微信群状态 | 已入群 |
| 微信沟通人 | 联系人 | 李四 |
| 房屋状态 | 居住状态 | 自住/租户/空置 |

---

## 测试

```bash
# 后端测试
cd backend && npm test

# 前端测试
cd frontend && npm test
```

### CI/CD

- **CI 测试**: 每次 Push/PR 自动运行测试
- **Docker 构建**: Push 到 main 分支自动构建镜像

---

## 生产部署检查清单

- [ ] 修改默认管理员密码
- [ ] 设置强随机 JWT_SECRET
- [ ] 配置生产数据库凭证
- [ ] 启用 HTTPS
- [ ] 设置 NODE_ENV=production
- [ ] 配置数据库备份策略

---

## License

MIT
