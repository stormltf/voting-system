-- 权限系统优化迁移脚本
-- 实现三级角色体系：super_admin（超级管理员）、community_admin（小区管理员）、community_user（小区普通用户）
--
-- 角色说明：
--   super_admin: 超级管理员，可以查看和管理所有小区，community_id 为 NULL
--   community_admin: 小区管理员，可以查看和管理本小区的数据
--   community_user: 小区普通用户，只能查看本小区的数据

-- ============================================
-- Part 1: Users 表修改
-- ============================================

-- 1.1 先将旧的角色值转换为临时值（避免 ENUM 修改时数据丢失）
UPDATE users SET role = 'super_admin' WHERE role = 'admin';
UPDATE users SET role = 'community_user' WHERE role = 'staff';

-- 1.2 修改 users 表的 role 字段，支持新的角色类型
-- 注意：MySQL 会自动处理已存在的值，TiDB 使用 VARCHAR 不需要此步骤
-- 如果是 MySQL，执行：
-- ALTER TABLE users MODIFY COLUMN role ENUM('super_admin', 'community_admin', 'community_user') DEFAULT 'community_user';

-- 1.3 添加 community_id 字段（如果不存在）
-- 先检查列是否存在，不存在则添加
SET @exist := (SELECT COUNT(*) FROM information_schema.columns
               WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'community_id');
SET @sql := IF(@exist = 0,
               'ALTER TABLE users ADD COLUMN community_id INT DEFAULT NULL AFTER role',
               'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 1.4 添加索引（忽略已存在的错误）
CREATE INDEX idx_users_community ON users(community_id);
CREATE INDEX idx_users_role ON users(role);

-- ============================================
-- Part 2: Votes 表修改（扫楼功能）
-- ============================================

-- 2.1 添加 sweep_status 字段（如果不存在）
SET @exist := (SELECT COUNT(*) FROM information_schema.columns
               WHERE table_schema = DATABASE() AND table_name = 'votes' AND column_name = 'sweep_status');
SET @sql := IF(@exist = 0,
               'ALTER TABLE votes ADD COLUMN sweep_status VARCHAR(20) DEFAULT ''pending''',
               'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2.2 添加 sweep_remark 字段（如果不存在）
SET @exist := (SELECT COUNT(*) FROM information_schema.columns
               WHERE table_schema = DATABASE() AND table_name = 'votes' AND column_name = 'sweep_remark');
SET @sql := IF(@exist = 0,
               'ALTER TABLE votes ADD COLUMN sweep_remark TEXT',
               'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2.3 添加 sweep_date 字段（如果不存在）
SET @exist := (SELECT COUNT(*) FROM information_schema.columns
               WHERE table_schema = DATABASE() AND table_name = 'votes' AND column_name = 'sweep_date');
SET @sql := IF(@exist = 0,
               'ALTER TABLE votes ADD COLUMN sweep_date DATE',
               'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
