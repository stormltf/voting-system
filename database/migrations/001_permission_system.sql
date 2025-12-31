-- 权限系统优化迁移脚本
-- 实现三级角色体系：super_admin（超级管理员）、community_admin（小区管理员）、community_user（小区普通用户）

-- 1. 修改 users 表的 role 字段，支持新的角色类型
ALTER TABLE users
MODIFY COLUMN role ENUM('super_admin', 'community_admin', 'community_user') DEFAULT 'community_user';

-- 2. 添加 community_id 字段，关联用户所属小区（超级管理员此字段为 NULL）
ALTER TABLE users
ADD COLUMN community_id INT DEFAULT NULL AFTER role;

-- 3. 添加外键约束
ALTER TABLE users
ADD CONSTRAINT fk_users_community
FOREIGN KEY (community_id) REFERENCES communities(id) ON DELETE SET NULL;

-- 4. 添加索引，优化按小区查询用户的性能
CREATE INDEX idx_users_community ON users(community_id);
CREATE INDEX idx_users_role ON users(role);

-- 5. 将现有的 admin 用户迁移为 super_admin
-- 注意：这一步需要在修改 ENUM 之后执行，因为旧的 'admin' 值会被转换
-- 如果有旧数据，需要手动处理

-- 6. 添加注释说明
-- super_admin: 超级管理员，可以查看和管理所有小区，community_id 为 NULL
-- community_admin: 小区管理员，可以查看和管理本小区的数据
-- community_user: 小区普通用户，只能查看本小区的数据
