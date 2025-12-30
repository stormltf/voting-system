# 业主大会投票管理系统

[![CI](https://github.com/YOUR_USERNAME/voting-system/actions/workflows/ci.yml/badge.svg)](https://github.com/YOUR_USERNAME/voting-system/actions/workflows/ci.yml)
[![Docker Build](https://github.com/YOUR_USERNAME/voting-system/actions/workflows/docker-build.yml/badge.svg)](https://github.com/YOUR_USERNAME/voting-system/actions/workflows/docker-build.yml)

一个用于管理小区业主大会投票的全栈应用系统，支持多小区、多期数、多轮投票的完整管理流程。

## 技术栈

### 前端
- **框架**: Next.js 16.1.1 (React 19.2.3)
- **语言**: TypeScript 5
- **样式**: TailwindCSS 4 + PostCSS
- **UI 组件**: lucide-react (图标库)
- **数据可视化**: Recharts 3.6.0
- **HTTP 客户端**: Axios 1.13.2
- **测试**: Jest 29.7.0 + React Testing Library 16.1.0

### 后端
- **框架**: Express.js 4.18.2 (Node.js)
- **数据库**: MySQL 8 (mysql2 3.6.5)
- **认证**: JWT (jsonwebtoken 9.0.2)
- **密码加密**: bcryptjs 2.4.3
- **文件上传**: multer 1.4.5
- **Excel 处理**: xlsx 0.18.5
- **测试**: Jest 29.7.0 + Supertest 7.0.0

## 功能特性

### 核心功能
- **多小区管理**: 支持多个小区的独立管理
- **多期数支持**: 每个小区可包含多个期数（如一期、二期）
- **业主信息管理**: 完整的 CRUD 操作，支持 Excel 批量导入
- **多轮投票管理**: 支持创建多个投票轮次，独立统计
- **投票状态追踪**: 跟踪每个业主的投票状态（未投票/已投票/拒绝/现场/视频/扫楼）
- **投票统计分析**:
  - 按户数统计投票率
  - 按面积加权统计投票率
  - 支持多维度分析（小区/期数/楼栋）
- **数据可视化**: 仪表板展示投票进度和统计数据

### 用户系统
- JWT 身份认证
- 角色权限控制（admin/staff）
- 密码安全加密存储

## 快速开始

### 环境要求
- Node.js v16+
- MySQL 8.0+
- npm 或 yarn

### 1. 数据库配置

```bash
# 登录 MySQL
mysql -u root -p

# 执行数据库初始化脚本
source database/schema.sql

# （可选）导入测试数据
source database/import_data.sql
source database/import_votes.sql
```

### 2. 后端配置

```bash
cd backend

# 复制环境变量配置
cp .env.example .env

# 编辑 .env 文件，配置数据库连接
vim .env
```

`.env` 文件配置示例：
```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=voting_system
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d
PORT=3001
```

```bash
# 安装依赖
npm install

# 开发模式启动（自动重启）
npm run dev

# 或生产模式启动
npm start
```

后端服务运行在 http://localhost:3001

### 3. 前端配置

```bash
cd frontend

# 安装依赖
npm install

# 开发模式启动
npm run dev
```

前端服务运行在 http://localhost:3000

（可选）创建 `.env.local` 文件配置 API 地址：
```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

### 4. 登录系统

默认管理员账户：
- 用户名: `admin`
- 密码: `admin123`

> ⚠️ **安全提示**: 生产环境请务必修改默认密码和 JWT_SECRET

## 项目结构

```
voting-system/
├── backend/                    # Express 后端服务
│   ├── src/
│   │   ├── index.js           # 应用入口
│   │   ├── routes/            # API 路由
│   │   │   ├── auth.js        # 认证路由
│   │   │   ├── communities.js # 小区和期数管理
│   │   │   ├── owners.js      # 业主管理
│   │   │   └── votes.js       # 投票管理
│   │   ├── middleware/        # 中间件
│   │   │   └── auth.js        # JWT 验证
│   │   └── models/            # 数据库模型
│   │       └── db.js          # 数据库连接池
│   ├── tests/                 # 后端测试
│   ├── package.json
│   ├── jest.config.js
│   └── .env.example
│
├── frontend/                   # Next.js 前端应用
│   ├── src/
│   │   ├── app/               # Next.js App Router
│   │   │   ├── layout.tsx     # 根布局
│   │   │   ├── page.tsx       # 首页
│   │   │   ├── login/         # 登录页面
│   │   │   └── dashboard/     # 仪表板
│   │   │       ├── page.tsx              # 主页统计
│   │   │       ├── communities/page.tsx  # 小区管理
│   │   │       ├── owners/page.tsx       # 业主管理
│   │   │       ├── votes/page.tsx        # 投票管理
│   │   │       └── settings/page.tsx     # 系统设置
│   │   ├── components/        # 可复用组件
│   │   │   ├── StatsCard.tsx  # 统计卡片
│   │   │   ├── DataTable.tsx  # 数据表格
│   │   │   └── Sidebar.tsx    # 侧边导航
│   │   ├── contexts/          # React Context
│   │   │   └── AuthContext.tsx
│   │   └── lib/               # 工具函数
│   │       ├── api.ts         # API 客户端
│   │       └── utils.ts       # 工具函数
│   ├── public/                # 静态资源
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.ts
│   └── jest.config.js
│
└── database/                   # 数据库脚本
    ├── schema.sql             # 数据库结构
    ├── import_data.sql        # 业主数据导入
    └── import_votes.sql       # 投票数据导入
```

## 数据库设计

### ER 关系

```
communities (小区)
    └── phases (期数) 1:N
            └── owners (业主) 1:N
                    └── votes (投票记录) 1:N
                            └── vote_rounds (投票轮次) N:1
```

### 数据表概览

| 表名 | 说明 | 字段数 | 关键约束 |
|------|------|--------|----------|
| `users` | 系统用户 | 6 | username 唯一 |
| `communities` | 小区 | 5 | - |
| `phases` | 期数 | 6 | (community_id, code) 联合唯一 |
| `owners` | 业主 | 17 | (phase_id, room_number) 联合唯一 |
| `vote_rounds` | 投票轮次 | 9 | - |
| `votes` | 投票记录 | 9 | (owner_id, round_id) 联合唯一 |

### 完整 SQL 建表语句

```sql
-- 业主大会投票管理系统 数据库结构
-- 创建数据库
CREATE DATABASE IF NOT EXISTS voting_system
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE voting_system;

-- 1. 系统用户表
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(100),
  role ENUM('admin', 'staff') DEFAULT 'staff',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. 小区表
CREATE TABLE IF NOT EXISTS communities (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  address VARCHAR(255),
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. 期数表
CREATE TABLE IF NOT EXISTS phases (
  id INT AUTO_INCREMENT PRIMARY KEY,
  community_id INT NOT NULL,
  name VARCHAR(50) NOT NULL,
  code VARCHAR(10) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (community_id) REFERENCES communities(id) ON DELETE CASCADE,
  UNIQUE KEY unique_phase (community_id, code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. 业主表
CREATE TABLE IF NOT EXISTS owners (
  id INT AUTO_INCREMENT PRIMARY KEY,
  phase_id INT NOT NULL,
  seq_no INT,
  building VARCHAR(10),
  unit VARCHAR(10),
  room VARCHAR(10),
  room_number VARCHAR(20) NOT NULL,
  owner_name VARCHAR(100),
  area DECIMAL(10,2),
  parking_no VARCHAR(20),
  parking_area DECIMAL(10,2),
  phone1 VARCHAR(30),
  phone2 VARCHAR(30),
  phone3 VARCHAR(30),
  wechat_status VARCHAR(20) DEFAULT '',
  wechat_contact VARCHAR(100),
  house_status VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (phase_id) REFERENCES phases(id) ON DELETE CASCADE,
  UNIQUE KEY unique_room (phase_id, room_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. 投票轮次表
CREATE TABLE IF NOT EXISTS vote_rounds (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  year INT NOT NULL,
  round_code VARCHAR(20),
  start_date DATE,
  end_date DATE,
  status ENUM('draft', 'active', 'closed') DEFAULT 'draft',
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. 投票记录表
CREATE TABLE IF NOT EXISTS votes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  owner_id INT NOT NULL,
  round_id INT NOT NULL,
  vote_status ENUM('pending', 'voted', 'refused', 'onsite', 'video', 'sweep') DEFAULT 'pending',
  vote_phone VARCHAR(50),
  vote_date DATE,
  remark TEXT,
  sweep_status VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE CASCADE,
  FOREIGN KEY (round_id) REFERENCES vote_rounds(id) ON DELETE CASCADE,
  UNIQUE KEY unique_vote (owner_id, round_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 创建索引以提升查询性能
CREATE INDEX idx_owners_phase ON owners(phase_id);
CREATE INDEX idx_owners_building ON owners(building);
CREATE INDEX idx_owners_name ON owners(owner_name);
CREATE INDEX idx_votes_round ON votes(round_id);
CREATE INDEX idx_votes_status ON votes(vote_status);
```

### 初始化数据

```sql
-- 插入默认管理员账户 (密码: admin123)
INSERT INTO users (username, password, name, role) VALUES
('admin', '$2a$10$r52knN1WReUMaI3yLGcDVeSAPc5m.HbslMUuwFB6084KN5DeE5.5C', '系统管理员', 'admin');

-- 插入示例小区数据
INSERT INTO communities (name, address) VALUES
('示例小区', '北京市朝阳区示例路1号');

-- 插入示例期数数据
INSERT INTO phases (community_id, name, code) VALUES
(1, '二期', '2'),
(1, '三期', '3');

-- 插入示例投票轮次
INSERT INTO vote_rounds (name, year, round_code, status) VALUES
('2023年业主大会', 2023, '2023', 'closed'),
('2024年业主大会', 2024, '2024', 'closed'),
('2025年A轮业主大会', 2025, '2025A', 'closed'),
('2025年B轮业主大会', 2025, '2025B', 'active');
```

### 字段详细说明

#### users 表（系统用户）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT | 主键，自增 |
| username | VARCHAR(50) | 用户名，唯一 |
| password | VARCHAR(255) | bcrypt 加密密码 |
| name | VARCHAR(100) | 用户真实姓名 |
| role | ENUM | 角色：admin/staff |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

#### communities 表（小区）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT | 主键，自增 |
| name | VARCHAR(100) | 小区名称 |
| address | VARCHAR(255) | 小区地址 |
| description | TEXT | 描述信息 |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

#### phases 表（期数）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT | 主键，自增 |
| community_id | INT | 外键，关联小区 |
| name | VARCHAR(50) | 期数名称（如"二期"） |
| code | VARCHAR(10) | 期数代码（如"2"） |
| description | TEXT | 描述信息 |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

#### owners 表（业主）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT | 主键，自增 |
| phase_id | INT | 外键，关联期数 |
| seq_no | INT | 序号 |
| building | VARCHAR(10) | 楼栋号 |
| unit | VARCHAR(10) | 单元号 |
| room | VARCHAR(10) | 房间号 |
| room_number | VARCHAR(20) | 完整房间号（如"01-01-0101"） |
| owner_name | VARCHAR(100) | 业主姓名 |
| area | DECIMAL(10,2) | 房屋面积（m²） |
| parking_no | VARCHAR(20) | 车位号 |
| parking_area | DECIMAL(10,2) | 车位面积（m²） |
| phone1 | VARCHAR(30) | 联系电话1 |
| phone2 | VARCHAR(30) | 联系电话2 |
| phone3 | VARCHAR(30) | 联系电话3 |
| wechat_status | VARCHAR(20) | 微信沟通状态 |
| wechat_contact | VARCHAR(100) | 微信联系人 |
| house_status | VARCHAR(50) | 房屋状态（自住/租户/空置） |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

#### vote_rounds 表（投票轮次）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT | 主键，自增 |
| name | VARCHAR(100) | 轮次名称 |
| year | INT | 年份 |
| round_code | VARCHAR(20) | 轮次代码 |
| start_date | DATE | 开始日期 |
| end_date | DATE | 结束日期 |
| status | ENUM | 状态：draft/active/closed |
| description | TEXT | 描述信息 |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

#### votes 表（投票记录）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT | 主键，自增 |
| owner_id | INT | 外键，关联业主 |
| round_id | INT | 外键，关联轮次 |
| vote_status | ENUM | 投票状态：pending/voted/refused/onsite/video/sweep |
| vote_phone | VARCHAR(50) | 投票联系电话 |
| vote_date | DATE | 投票日期 |
| remark | TEXT | 备注 |
| sweep_status | VARCHAR(100) | 扫楼情况 |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

### 索引说明

| 索引名 | 表 | 字段 | 用途 |
|--------|-----|------|------|
| idx_owners_phase | owners | phase_id | 按期数快速查询业主 |
| idx_owners_building | owners | building | 按楼栋统计 |
| idx_owners_name | owners | owner_name | 按姓名搜索 |
| idx_votes_round | votes | round_id | 按轮次查询投票 |
| idx_votes_status | votes | vote_status | 按状态筛选投票 |

## API 接口文档

### 认证接口

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| POST | `/api/auth/login` | 用户登录 | 公开 |
| GET | `/api/auth/me` | 获取当前用户信息 | 登录 |
| PUT | `/api/auth/password` | 修改密码 | 登录 |
| POST | `/api/auth/users` | 创建新用户 | 管理员 |

### 小区管理接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/communities` | 获取所有小区列表 |
| POST | `/api/communities` | 创建小区 |
| GET | `/api/communities/:id` | 获取小区详情 |
| PUT | `/api/communities/:id` | 更新小区 |
| DELETE | `/api/communities/:id` | 删除小区 |
| GET | `/api/communities/:communityId/phases` | 获取期数列表 |
| POST | `/api/communities/:communityId/phases` | 创建期数 |
| PUT | `/api/communities/phases/:id` | 更新期数 |
| DELETE | `/api/communities/phases/:id` | 删除期数 |

### 业主管理接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/owners` | 获取业主列表（支持分页、搜索、筛选） |
| POST | `/api/owners` | 创建业主 |
| GET | `/api/owners/:id` | 获取业主详情 |
| PUT | `/api/owners/:id` | 更新业主信息 |
| DELETE | `/api/owners/:id` | 删除业主 |
| POST | `/api/owners/import` | 批量导入业主数据 |
| GET | `/api/owners/buildings/:phaseId` | 获取楼栋列表 |

### 投票管理接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/votes/rounds` | 获取所有投票轮次 |
| POST | `/api/votes/rounds` | 创建投票轮次 |
| GET | `/api/votes/rounds/:id` | 获取轮次详情 |
| PUT | `/api/votes/rounds/:id` | 更新轮次 |
| DELETE | `/api/votes/rounds/:id` | 删除轮次 |
| GET | `/api/votes` | 获取投票记录 |
| POST | `/api/votes` | 创建/更新投票记录 |
| PUT | `/api/votes/batch` | 批量更新投票状态 |
| GET | `/api/votes/stats` | 获取投票统计 |
| GET | `/api/votes/progress` | 获取投票进度 |

## Excel 导入格式

导入业主数据的 Excel 文件需包含以下列：

| 列名 | 说明 | 示例 |
|------|------|------|
| 序号 | 业主序号 | 1 |
| 房间号 | 格式: 楼栋-单元-房号 | 01-01-0101 |
| 姓名 | 业主姓名 | 张三 |
| 面积 | 房屋面积（m²） | 89.5 |
| 车位号 | 车位编号 | B-001 |
| 车位面积 | 车位面积（m²） | 12.5 |
| 联系电话1 | 主要联系电话 | 13800138000 |
| 联系电话2 | 备用电话 | - |
| 联系电话3 | 备用电话 | - |
| 群状态 | 微信群状态 | 已入群/未入群 |
| 微信沟通人 | 微信联系人 | 李四 |
| 房屋状态 | 居住状态 | 自住/租户/空置 |

## 投票状态说明

| 状态码 | 中文名称 | 说明 |
|--------|----------|------|
| `pending` | 未投票 | 默认状态 |
| `voted` | 已投票 | 已完成投票 |
| `refused` | 拒绝投票 | 业主拒绝参与 |
| `onsite` | 现场投票 | 现场参与投票 |
| `video` | 视频投票 | 视频方式投票 |
| `sweep` | 扫楼 | 扫楼方式收集 |

## 测试

### 后端测试

```bash
cd backend
npm test
```

### 前端测试

```bash
cd frontend
npm test
```

## Docker 一键部署

### 快速启动

```bash
# 1. 复制环境变量配置
cp .env.docker .env

# 2. 启动所有服务（首次启动会构建镜像，需要几分钟）
docker-compose up -d

# 3. 查看服务状态
docker-compose ps

# 4. 查看日志
docker-compose logs -f
```

启动后访问：
- 前端：http://localhost:3000
- 后端 API：http://localhost:3001
- 默认账号：admin / admin123

### 常用命令

```bash
# 停止所有服务
docker-compose down

# 停止并删除数据卷（清空数据库）
docker-compose down -v

# 重新构建镜像
docker-compose build --no-cache

# 只启动某个服务
docker-compose up -d mysql
docker-compose up -d backend
docker-compose up -d frontend

# 进入容器
docker exec -it voting-mysql mysql -uvoting -pvoting123 voting_system
docker exec -it voting-backend sh
docker exec -it voting-frontend sh
```

### 自定义配置

编辑 `.env` 文件修改配置：

```env
# MySQL 配置
MYSQL_ROOT_PASSWORD=your_root_password
MYSQL_DATABASE=voting_system
MYSQL_USER=voting
MYSQL_PASSWORD=your_password

# JWT 密钥（生产环境必须修改）
JWT_SECRET=your-random-secret-key-at-least-32-chars

# 前端 API 地址（服务器部署时修改为服务器 IP）
NEXT_PUBLIC_API_URL=http://your-server-ip:3001/api
```

### 服务器部署

```bash
# 1. 安装 Docker 和 Docker Compose
curl -fsSL https://get.docker.com | sh
sudo apt install docker-compose -y

# 2. 克隆代码
git clone https://github.com/your-repo/voting-system.git
cd voting-system

# 3. 配置环境变量
cp .env.docker .env
vim .env  # 修改 NEXT_PUBLIC_API_URL 为服务器 IP

# 4. 启动服务
docker-compose up -d
```

### Docker 镜像说明

| 服务 | 镜像 | 端口 | 说明 |
|------|------|------|------|
| mysql | mysql:8.0 | 3306 | MySQL 数据库 |
| backend | 自构建 | 3001 | Node.js API 服务 |
| frontend | 自构建 | 3000 | Next.js 前端服务 |

---

## 生产部署

### 部署检查清单

- [ ] 修改默认管理员密码
- [ ] 设置强随机 JWT_SECRET
- [ ] 配置生产数据库凭证
- [ ] 启用 HTTPS
- [ ] 设置 NODE_ENV=production
- [ ] 配置数据库备份策略
- [ ] 配置日志收集

### 本地构建

```bash
cd frontend
npm run build
npm start
```

## 项目亮点

1. **完整投票流程**: 从业主管理到投票统计的全流程覆盖
2. **Excel 批量导入**: 支持 Excel 文件批量导入业主数据
3. **双维度统计**: 同时支持按户数和按面积加权的投票率统计
4. **多层级管理**: 小区 → 期数 → 楼栋 → 业主的层级结构
5. **实时状态追踪**: 投票状态实时更新和追踪
6. **现代化技术栈**: Next.js 16 + React 19 + TypeScript + TailwindCSS

---

## CI/CD 自动化

### GitHub Actions 工作流

本项目配置了两个自动化工作流：

#### 1. CI 测试 (`.github/workflows/ci.yml`)

每次 Push 或 PR 到 main/master 分支时自动运行：
- 后端：启动 MySQL 服务，运行 Jest 测试
- 前端：运行测试并构建验证

#### 2. Docker 镜像构建 (`.github/workflows/docker-build.yml`)

Push 到 main/master 分支或创建 Tag 时自动构建并推送镜像到 GitHub Container Registry：

```bash
# 拉取镜像
docker pull ghcr.io/YOUR_USERNAME/voting-system/backend:latest
docker pull ghcr.io/YOUR_USERNAME/voting-system/frontend:latest
```

### 使用 GitHub 镜像部署

```bash
# 创建 docker-compose.prod.yml
version: '3.8'

services:
  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: your_password
      MYSQL_DATABASE: voting_system
    volumes:
      - mysql_data:/var/lib/mysql
      - ./database/init:/docker-entrypoint-initdb.d:ro

  backend:
    image: ghcr.io/YOUR_USERNAME/voting-system/backend:latest
    ports:
      - "3001:3001"
    environment:
      DB_HOST: mysql
      DB_USER: root
      DB_PASSWORD: your_password
      DB_NAME: voting_system
      JWT_SECRET: your-secret-key
    depends_on:
      - mysql

  frontend:
    image: ghcr.io/YOUR_USERNAME/voting-system/frontend:latest
    ports:
      - "3000:3000"
    depends_on:
      - backend

volumes:
  mysql_data:
```

```bash
# 启动
docker-compose -f docker-compose.prod.yml up -d
```

## License

MIT
