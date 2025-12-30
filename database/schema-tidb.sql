-- 业主大会投票管理系统 数据库结构 (TiDB Cloud 兼容版)
-- 注意：TiDB 不支持某些 MySQL 特性，此版本已做兼容处理

-- 创建数据库（在 TiDB Cloud 中可能需要单独执行或跳过）
-- CREATE DATABASE IF NOT EXISTS voting_system;
-- USE voting_system;

-- 1. 系统用户表
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(100),
  role VARCHAR(10) DEFAULT 'staff',
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
CREATE TABLE IF NOT EXISTS phases (
  id INT AUTO_INCREMENT PRIMARY KEY,
  community_id INT NOT NULL,
  name VARCHAR(50) NOT NULL,
  code VARCHAR(10) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_phase (community_id, code)
);

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
  UNIQUE KEY unique_room (phase_id, room_number)
);

-- 5. 投票轮次表
CREATE TABLE IF NOT EXISTS vote_rounds (
  id INT AUTO_INCREMENT PRIMARY KEY,
  community_id INT,
  name VARCHAR(100) NOT NULL,
  year INT NOT NULL,
  round_code VARCHAR(20),
  start_date DATE,
  end_date DATE,
  status VARCHAR(10) DEFAULT 'draft',
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 6. 投票记录表
CREATE TABLE IF NOT EXISTS votes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  owner_id INT NOT NULL,
  round_id INT NOT NULL,
  vote_status VARCHAR(10) DEFAULT 'pending',
  vote_phone VARCHAR(50),
  vote_date DATE,
  remark TEXT,
  sweep_status VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_vote (owner_id, round_id)
);

-- 7. 操作日志表
CREATE TABLE IF NOT EXISTS operation_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  username VARCHAR(50),
  action VARCHAR(50) NOT NULL,
  module VARCHAR(50) NOT NULL,
  target_type VARCHAR(50),
  target_id INT,
  target_name VARCHAR(200),
  details TEXT,
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
CREATE INDEX idx_votes_round ON votes(round_id);
CREATE INDEX idx_votes_status ON votes(vote_status);
CREATE INDEX idx_logs_user ON operation_logs(user_id);
CREATE INDEX idx_logs_action ON operation_logs(action);
CREATE INDEX idx_logs_module ON operation_logs(module);
CREATE INDEX idx_logs_created ON operation_logs(created_at);

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

-- 插入示例投票轮次（关联小区）
INSERT INTO vote_rounds (community_id, name, year, round_code, status) VALUES
(1, '2023年业主大会', 2023, '2023', 'closed'),
(1, '2024年业主大会', 2024, '2024', 'closed'),
(1, '2025年A轮业主大会', 2025, '2025A', 'closed'),
(1, '2025年B轮业主大会', 2025, '2025B', 'active');
