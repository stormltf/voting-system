-- 短信通知功能数据库迁移
-- 执行时间: 2026-01-22

-- 8. 短信配置表（每个小区独立配置阿里云短信服务）
CREATE TABLE IF NOT EXISTS sms_configs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  community_id INT NOT NULL UNIQUE,
  access_key_id VARCHAR(100) NOT NULL,
  access_key_secret VARCHAR(255) NOT NULL,
  enabled TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (community_id) REFERENCES communities(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. 短信模板表
CREATE TABLE IF NOT EXISTS sms_templates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  community_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  template_code VARCHAR(50) NOT NULL,
  sign_name VARCHAR(50) NOT NULL,
  content_preview TEXT,
  variable_mapping JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (community_id) REFERENCES communities(id) ON DELETE CASCADE,
  INDEX idx_sms_templates_community (community_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. 短信发送任务表
CREATE TABLE IF NOT EXISTS sms_tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  community_id INT NOT NULL,
  template_id INT NOT NULL,
  task_type ENUM('vote_notice', 'community_notice') NOT NULL,
  round_id INT DEFAULT NULL,
  target_buildings JSON,
  target_filter ENUM('all', 'not_voted') DEFAULT 'all',
  total_count INT DEFAULT 0,
  success_count INT DEFAULT 0,
  fail_count INT DEFAULT 0,
  no_phone_count INT DEFAULT 0,
  status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
  operator_id INT NOT NULL,
  operator_name VARCHAR(100),
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (community_id) REFERENCES communities(id) ON DELETE CASCADE,
  FOREIGN KEY (template_id) REFERENCES sms_templates(id) ON DELETE CASCADE,
  FOREIGN KEY (round_id) REFERENCES vote_rounds(id) ON DELETE SET NULL,
  FOREIGN KEY (operator_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_sms_tasks_community (community_id),
  INDEX idx_sms_tasks_status (status),
  INDEX idx_sms_tasks_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. 短信发送记录表（每条短信的发送详情）
CREATE TABLE IF NOT EXISTS sms_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  task_id INT NOT NULL,
  owner_id INT NOT NULL,
  owner_name VARCHAR(100),
  phone VARCHAR(30) NOT NULL,
  template_params JSON,
  status ENUM('pending', 'success', 'failed') DEFAULT 'pending',
  aliyun_request_id VARCHAR(100),
  aliyun_biz_id VARCHAR(100),
  error_code VARCHAR(50),
  error_message TEXT,
  sent_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES sms_tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE CASCADE,
  INDEX idx_sms_logs_task (task_id),
  INDEX idx_sms_logs_status (status),
  INDEX idx_sms_logs_owner (owner_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
