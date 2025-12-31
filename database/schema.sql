-- 业主大会投票管理系统 数据库结构
-- 创建数据库
CREATE DATABASE IF NOT EXISTS voting_system DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
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
  sweep_status VARCHAR(20) DEFAULT 'pending',
  sweep_remark TEXT,
  sweep_date TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (phase_id) REFERENCES phases(id) ON DELETE CASCADE,
  UNIQUE KEY unique_room (phase_id, room_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. 投票轮次表
CREATE TABLE IF NOT EXISTS vote_rounds (
  id INT AUTO_INCREMENT PRIMARY KEY,
  community_id INT,
  name VARCHAR(100) NOT NULL,
  year INT NOT NULL,
  round_code VARCHAR(20),
  start_date DATE,
  end_date DATE,
  status ENUM('draft', 'active', 'closed') DEFAULT 'draft',
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (community_id) REFERENCES communities(id) ON DELETE CASCADE,
  INDEX idx_vote_rounds_community (community_id)
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
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_logs_user (user_id),
  INDEX idx_logs_action (action),
  INDEX idx_logs_module (module),
  INDEX idx_logs_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 创建索引以提升查询性能
CREATE INDEX idx_owners_phase ON owners(phase_id);
CREATE INDEX idx_owners_building ON owners(building);
CREATE INDEX idx_owners_name ON owners(owner_name);
CREATE INDEX idx_votes_round ON votes(round_id);
CREATE INDEX idx_votes_status ON votes(vote_status);

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
