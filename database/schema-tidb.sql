-- 业主大会投票管理系统 数据库结构 (TiDB Cloud 兼容版)
-- 注意：TiDB 不支持某些 MySQL 特性，此版本已做兼容处理
--
-- TiDB 与 MySQL 主要差异：
--   1. 不支持 ENUM 类型，使用 VARCHAR 替代
--   2. 不强制外键约束（本文件用注释标明逻辑外键关系）
--   3. 端口为 4000（非 MySQL 的 3306）
--   4. GROUP BY 严格模式：SELECT 中的非聚合列必须在 GROUP BY 中
--   5. HAVING 不支持列别名，需使用聚合函数表达式

-- 创建数据库（在 TiDB Cloud 中可能需要单独执行或跳过）
-- CREATE DATABASE IF NOT EXISTS voting_system;
-- USE voting_system;

-- 1. 系统用户表
-- 角色说明：
--   super_admin: 超级管理员，可以查看和管理所有小区，community_id 为 NULL
--   community_admin: 小区管理员，可以查看和管理本小区的数据
--   community_user: 小区普通用户，只能查看本小区的数据
-- 逻辑外键：community_id -> communities(id)
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(100),
  role VARCHAR(20) DEFAULT 'community_user',  -- 有效值: super_admin, community_admin, community_user
  community_id INT DEFAULT NULL,              -- 逻辑外键 -> communities(id)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. 小区表
CREATE TABLE IF NOT EXISTS communities (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  address VARCHAR(255),
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 3. 期数表
-- 逻辑外键：community_id -> communities(id) ON DELETE CASCADE
CREATE TABLE IF NOT EXISTS phases (
  id INT AUTO_INCREMENT PRIMARY KEY,
  community_id INT NOT NULL,                  -- 逻辑外键 -> communities(id)
  name VARCHAR(50) NOT NULL,
  code VARCHAR(10) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_phase (community_id, code)
);

-- 4. 业主表
-- 逻辑外键：phase_id -> phases(id) ON DELETE CASCADE
CREATE TABLE IF NOT EXISTS owners (
  id INT AUTO_INCREMENT PRIMARY KEY,
  phase_id INT NOT NULL,                      -- 逻辑外键 -> phases(id)
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
  UNIQUE KEY unique_room (phase_id, room_number)
);

-- 5. 投票轮次表
-- 逻辑外键：community_id -> communities(id) ON DELETE CASCADE
CREATE TABLE IF NOT EXISTS vote_rounds (
  id INT AUTO_INCREMENT PRIMARY KEY,
  community_id INT,                           -- 逻辑外键 -> communities(id)
  name VARCHAR(100) NOT NULL,
  year INT NOT NULL,
  round_code VARCHAR(20),
  start_date DATE,
  end_date DATE,
  status VARCHAR(10) DEFAULT 'draft',         -- 有效值: draft, active, closed
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 6. 投票记录表
-- 逻辑外键：owner_id -> owners(id) ON DELETE CASCADE
-- 逻辑外键：round_id -> vote_rounds(id) ON DELETE CASCADE
-- vote_status 有效值: pending(未投票), voted(已投票), refused(拒绝), onsite(现场投票), video(视频投票)
-- sweep_status 有效值: pending(待扫楼), contacted(已联系), completed(已完成), unreachable(无法联系)
CREATE TABLE IF NOT EXISTS votes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  owner_id INT NOT NULL,                      -- 逻辑外键 -> owners(id)
  round_id INT NOT NULL,                      -- 逻辑外键 -> vote_rounds(id)
  vote_status VARCHAR(10) DEFAULT 'pending',  -- 有效值: pending, voted, refused, onsite, video
  vote_phone VARCHAR(50),
  vote_date DATE,
  remark TEXT,
  sweep_status VARCHAR(20) DEFAULT 'pending', -- 有效值: pending, contacted, completed, unreachable
  sweep_remark TEXT,
  sweep_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_vote (owner_id, round_id)
);

-- 7. 操作日志表
-- 逻辑外键：user_id -> users(id)（不级联删除，保留日志）
CREATE TABLE IF NOT EXISTS operation_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,                                -- 逻辑外键 -> users(id)
  username VARCHAR(50),
  action VARCHAR(50) NOT NULL,                -- 操作类型: create, update, delete, import, login 等
  module VARCHAR(50) NOT NULL,                -- 模块: users, communities, owners, votes 等
  target_type VARCHAR(50),
  target_id INT,
  target_name VARCHAR(200),
  details TEXT,                               -- JSON 格式的详细信息
  ip_address VARCHAR(50),
  user_agent VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX idx_phases_community ON phases(community_id);
CREATE INDEX idx_owners_phase ON owners(phase_id);
CREATE INDEX idx_owners_building ON owners(building);
CREATE INDEX idx_owners_name ON owners(owner_name);
CREATE INDEX idx_vote_rounds_community ON vote_rounds(community_id);
CREATE INDEX idx_votes_owner ON votes(owner_id);
CREATE INDEX idx_votes_round ON votes(round_id);
CREATE INDEX idx_votes_status ON votes(vote_status);
CREATE INDEX idx_votes_sweep_status ON votes(sweep_status);
CREATE INDEX idx_logs_user ON operation_logs(user_id);
CREATE INDEX idx_logs_action ON operation_logs(action);
CREATE INDEX idx_logs_module ON operation_logs(module);
CREATE INDEX idx_logs_created ON operation_logs(created_at);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_community ON users(community_id);

-- 插入默认超级管理员账户 (密码: admin123)
INSERT INTO users (username, password, name, role, community_id) VALUES
('admin', '$2a$10$r52knN1WReUMaI3yLGcDVeSAPc5m.HbslMUuwFB6084KN5DeE5.5C', '系统管理员', 'super_admin', NULL);

-- 插入示例小区数据
INSERT INTO communities (name, address) VALUES
('示例小区', '北京市朝阳区示例路1号');

-- 插入示例期数数据
INSERT INTO phases (community_id, name, code) VALUES
(1, '二期', '2'),
(1, '三期', '3');

-- 插入示例投票轮次（关联小区）
INSERT INTO vote_rounds (community_id, name, year, round_code, status) VALUES
(1, '2023年业主大会', 2023, '2023', 'closed'),
(1, '2024年业主大会', 2024, '2024', 'closed'),
(1, '2025年A轮业主大会', 2025, '2025A', 'closed'),
(1, '2025年B轮业主大会', 2025, '2025B', 'active');
