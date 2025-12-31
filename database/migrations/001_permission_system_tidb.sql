-- 权限系统优化迁移脚本 (TiDB 版本)
-- 实现三级角色体系：super_admin（超级管理员）、community_admin（小区管理员）、community_user（小区普通用户）
--
-- 角色说明：
--   super_admin: 超级管理员，可以查看和管理所有小区，community_id 为 NULL
--   community_admin: 小区管理员，可以查看和管理本小区的数据
--   community_user: 小区普通用户，只能查看本小区的数据
--
-- 注意：TiDB 不支持 PREPARE/EXECUTE，请按需执行以下语句
-- 如果某列/索引已存在，对应语句会报错，可以忽略

-- ============================================
-- Part 1: Users 表修改
-- ============================================

-- 1.1 先扩展 role 字段长度（重要！必须先执行）
ALTER TABLE users MODIFY COLUMN role VARCHAR(20) DEFAULT 'community_user';

-- 1.2 将旧的角色值转换为新值
UPDATE users SET role = 'super_admin' WHERE role = 'admin';
UPDATE users SET role = 'community_user' WHERE role = 'staff';

-- 1.3 添加 community_id 字段（如果已存在会报错，忽略即可）
ALTER TABLE users ADD COLUMN community_id INT DEFAULT NULL;

-- 1.4 添加索引（如果已存在会报错，忽略即可）
CREATE INDEX idx_users_community ON users(community_id);
CREATE INDEX idx_users_role ON users(role);

-- ============================================
-- Part 2: Votes 表修改（扫楼功能）
-- ============================================

-- 2.1 添加 sweep_status 字段（如果已存在会报错，忽略即可）
ALTER TABLE votes ADD COLUMN sweep_status VARCHAR(20) DEFAULT 'pending';

-- 2.2 添加 sweep_remark 字段（如果已存在会报错，忽略即可）
ALTER TABLE votes ADD COLUMN sweep_remark TEXT;

-- 2.3 添加 sweep_date 字段（如果已存在会报错，忽略即可）
ALTER TABLE votes ADD COLUMN sweep_date DATE;
