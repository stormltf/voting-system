-- 初始化数据
-- Docker MySQL 容器启动时自动执行

-- 插入默认超级管理员账户 (密码: admin123)
-- super_admin 不需要关联小区，community_id 为 NULL
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
