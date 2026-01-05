const request = require('supertest');
const bcrypt = require('bcryptjs');

// Mock 数据库模块
jest.mock('../../src/models/db', () => require('../mocks/db'));

const { pool } = require('../../src/models/db');
const { generateToken, ROLES } = require('../../src/middleware/auth');
const { app } = require('../../src/index');

describe('Auth Routes', () => {
  let superAdminToken;
  let communityAdminToken;
  let communityUserToken;

  beforeAll(() => {
    superAdminToken = generateToken({ id: 1, username: 'superadmin', role: ROLES.SUPER_ADMIN, community_id: null });
    communityAdminToken = generateToken({ id: 2, username: 'cadmin', role: ROLES.COMMUNITY_ADMIN, community_id: 1 });
    communityUserToken = generateToken({ id: 3, username: 'user', role: ROLES.COMMUNITY_USER, community_id: 1 });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/login', () => {
    it('应该拒绝空的用户名或密码', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ username: '', password: '' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('用户名和密码不能为空');
    });

    it('应该拒绝不存在的用户', async () => {
      pool.query.mockResolvedValueOnce([[]]);

      const response = await request(app)
        .post('/api/auth/login')
        .send({ username: 'nonexistent', password: 'password123' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('用户名或密码错误');
    });

    it('应该拒绝错误的密码', async () => {
      const hashedPassword = await bcrypt.hash('correctpassword', 10);
      pool.query.mockResolvedValueOnce([[
        { id: 1, username: 'testuser', password: hashedPassword, role: ROLES.SUPER_ADMIN, name: 'Test User', community_id: null }
      ]]);

      const response = await request(app)
        .post('/api/auth/login')
        .send({ username: 'testuser', password: 'wrongpassword' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('用户名或密码错误');
    });

    it('应该成功登录并返回 token', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      pool.query
        .mockResolvedValueOnce([[
          { id: 1, username: 'admin', password: hashedPassword, role: ROLES.SUPER_ADMIN, name: 'Admin User', community_id: null }
        ]])
        .mockResolvedValueOnce([{ insertId: 1 }]); // 记录日志

      const response = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'password123' });

      expect(response.status).toBe(200);
      expect(response.body.token).toBeDefined();
      expect(response.body.user).toBeDefined();
      expect(response.body.user.username).toBe('admin');
      expect(response.body.user.password).toBeUndefined(); // 不应返回密码
    });

    it('小区管理员登录应返回 communityId', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      pool.query
        .mockResolvedValueOnce([[
          { id: 2, username: 'cadmin', password: hashedPassword, role: ROLES.COMMUNITY_ADMIN, name: 'Community Admin', community_id: 5 }
        ]])
        .mockResolvedValueOnce([{ insertId: 1 }]); // 记录日志

      const response = await request(app)
        .post('/api/auth/login')
        .send({ username: 'cadmin', password: 'password123' });

      expect(response.status).toBe(200);
      expect(response.body.user.communityId).toBe(5);
      expect(response.body.user.role).toBe(ROLES.COMMUNITY_ADMIN);
    });

    it('应该处理服务器错误', async () => {
      pool.query.mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'password123' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('服务器内部错误，请稍后重试');
    });
  });

  describe('GET /api/auth/me', () => {
    it('应该拒绝未认证的请求', async () => {
      const response = await request(app).get('/api/auth/me');

      expect(response.status).toBe(401);
    });

    it('应该返回当前用户信息', async () => {
      pool.query.mockResolvedValueOnce([[
        { id: 1, username: 'admin', name: 'Admin User', role: ROLES.SUPER_ADMIN, community_id: null, community_name: null, created_at: new Date() }
      ]]);

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.username).toBe('admin');
      expect(response.body.role).toBe(ROLES.SUPER_ADMIN);
    });

    it('应该返回小区管理员的小区信息', async () => {
      pool.query.mockResolvedValueOnce([[
        { id: 2, username: 'cadmin', name: 'Community Admin', role: ROLES.COMMUNITY_ADMIN, community_id: 1, community_name: '阳光花园', created_at: new Date() }
      ]]);

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${communityAdminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.communityId).toBe(1);
      expect(response.body.communityName).toBe('阳光花园');
    });

    it('应该处理用户不存在的情况', async () => {
      const token = generateToken({ id: 999, username: 'ghost', role: ROLES.SUPER_ADMIN, community_id: null });
      pool.query.mockResolvedValueOnce([[]]);

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('用户不存在');
    });

    it('应该处理服务器错误', async () => {
      pool.query.mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('服务器内部错误，请稍后重试');
    });
  });

  describe('PUT /api/auth/password', () => {
    it('应该拒绝缺少旧密码或新密码', async () => {
      const response = await request(app)
        .put('/api/auth/password')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ oldPassword: '', newPassword: '' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('请提供旧密码和新密码');
    });

    it('应该拒绝用户不存在的情况', async () => {
      pool.query.mockResolvedValueOnce([[]]); // 用户不存在

      const response = await request(app)
        .put('/api/auth/password')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ oldPassword: 'oldpassword', newPassword: 'newpassword' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('用户不存在');
    });

    it('应该拒绝错误的旧密码', async () => {
      const hashedPassword = await bcrypt.hash('correctpassword', 10);
      pool.query.mockResolvedValueOnce([[
        { id: 1, username: 'admin', password: hashedPassword }
      ]]);

      const response = await request(app)
        .put('/api/auth/password')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ oldPassword: 'wrongpassword', newPassword: 'newpassword123' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('旧密码错误');
    });

    it('应该成功修改密码', async () => {
      const hashedPassword = await bcrypt.hash('oldpassword', 10);
      pool.query
        .mockResolvedValueOnce([[{ id: 1, username: 'admin', password: hashedPassword }]])
        .mockResolvedValueOnce([{ affectedRows: 1 }])
        .mockResolvedValueOnce([{ insertId: 1 }]); // 记录日志

      const response = await request(app)
        .put('/api/auth/password')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ oldPassword: 'oldpassword', newPassword: 'newpassword123' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('密码修改成功');
    });

    it('应该处理服务器错误', async () => {
      pool.query.mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .put('/api/auth/password')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ oldPassword: 'oldpassword', newPassword: 'newpassword' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('服务器内部错误，请稍后重试');
    });
  });

  describe('GET /api/auth/users', () => {
    it('应该拒绝普通用户访问', async () => {
      const response = await request(app)
        .get('/api/auth/users')
        .set('Authorization', `Bearer ${communityUserToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('需要管理员权限');
    });

    it('超级管理员应该能获取所有用户列表', async () => {
      const mockUsers = [
        { id: 1, username: 'admin', name: 'Admin', role: ROLES.SUPER_ADMIN, community_id: null, community_name: null, created_at: new Date() },
        { id: 2, username: 'cadmin', name: 'Community Admin', role: ROLES.COMMUNITY_ADMIN, community_id: 1, community_name: '阳光花园', created_at: new Date() },
      ];
      pool.query.mockResolvedValueOnce([mockUsers]);

      const response = await request(app)
        .get('/api/auth/users')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
    });

    it('小区管理员只能获取本小区用户列表', async () => {
      const mockUsers = [
        { id: 3, username: 'user', name: 'User', role: ROLES.COMMUNITY_USER, community_id: 1, community_name: '阳光花园', created_at: new Date() },
      ];
      pool.query.mockResolvedValueOnce([mockUsers]);

      const response = await request(app)
        .get('/api/auth/users')
        .set('Authorization', `Bearer ${communityAdminToken}`);

      expect(response.status).toBe(200);
    });

    it('应该处理服务器错误', async () => {
      pool.query.mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .get('/api/auth/users')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('服务器内部错误，请稍后重试');
    });
  });

  describe('POST /api/auth/users', () => {
    it('小区管理员只能创建普通用户', async () => {
      const response = await request(app)
        .post('/api/auth/users')
        .set('Authorization', `Bearer ${communityAdminToken}`)
        .send({ username: 'newadmin', password: 'password123', role: ROLES.COMMUNITY_ADMIN });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('小区管理员只能创建普通用户');
    });

    it('普通用户不能创建用户', async () => {
      const response = await request(app)
        .post('/api/auth/users')
        .set('Authorization', `Bearer ${communityUserToken}`)
        .send({ username: 'newuser', password: 'password123' });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('需要管理员权限');
    });

    it('应该拒绝空的用户名或密码', async () => {
      const response = await request(app)
        .post('/api/auth/users')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ username: '', password: '' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('用户名和密码不能为空');
    });

    it('应该拒绝无效的角色类型', async () => {
      const response = await request(app)
        .post('/api/auth/users')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ username: 'newuser', password: 'password123', role: 'invalid_role' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('无效的角色类型');
    });

    it('超级管理员应该能成功创建超级管理员用户', async () => {
      pool.query
        .mockResolvedValueOnce([{ insertId: 2 }])
        .mockResolvedValueOnce([{ insertId: 1 }]); // 记录日志

      const response = await request(app)
        .post('/api/auth/users')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ username: 'newadmin', password: 'password123', name: 'New Admin', role: ROLES.SUPER_ADMIN });

      expect(response.status).toBe(201);
      expect(response.body.id).toBe(2);
      expect(response.body.username).toBe('newadmin');
      expect(response.body.role).toBe(ROLES.SUPER_ADMIN);
    });

    it('创建小区管理员需要指定 communityId', async () => {
      const response = await request(app)
        .post('/api/auth/users')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ username: 'cadmin', password: 'password123', role: ROLES.COMMUNITY_ADMIN });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('小区管理员和普通用户必须指定所属小区');
    });

    it('超级管理员应该能创建小区管理员', async () => {
      pool.query
        .mockResolvedValueOnce([[{ id: 1 }]]) // 验证小区
        .mockResolvedValueOnce([{ insertId: 3 }]) // 创建用户
        .mockResolvedValueOnce([{ insertId: 1 }]); // 记录日志

      const response = await request(app)
        .post('/api/auth/users')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ username: 'cadmin', password: 'password123', name: 'Community Admin', role: ROLES.COMMUNITY_ADMIN, communityId: 1 });

      expect(response.status).toBe(201);
      expect(response.body.role).toBe(ROLES.COMMUNITY_ADMIN);
      expect(response.body.communityId).toBe(1);
    });

    it('应该拒绝重复的用户名', async () => {
      const error = new Error('Duplicate entry');
      error.code = 'ER_DUP_ENTRY';
      pool.query.mockRejectedValueOnce(error);

      const response = await request(app)
        .post('/api/auth/users')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ username: 'existinguser', password: 'password123', role: ROLES.SUPER_ADMIN });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('用户名已存在');
    });

    it('应该拒绝不存在的小区', async () => {
      pool.query.mockResolvedValueOnce([[]]); // 小区不存在

      const response = await request(app)
        .post('/api/auth/users')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ username: 'newuser', password: 'password123', role: ROLES.COMMUNITY_ADMIN, communityId: 999 });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('指定的小区不存在');
    });

    it('小区管理员不能创建其他小区的用户', async () => {
      const response = await request(app)
        .post('/api/auth/users')
        .set('Authorization', `Bearer ${communityAdminToken}`)
        .send({ username: 'newuser', password: 'password123', role: ROLES.COMMUNITY_USER, communityId: 2 }); // 不同小区

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('只能创建本小区的用户');
    });

    it('小区管理员创建用户时自动使用自己的小区', async () => {
      pool.query
        .mockResolvedValueOnce([{ insertId: 4 }]) // 创建用户
        .mockResolvedValueOnce([{ insertId: 1 }]); // 记录日志

      const response = await request(app)
        .post('/api/auth/users')
        .set('Authorization', `Bearer ${communityAdminToken}`)
        .send({ username: 'newuser', password: 'password123', name: 'New User' }); // 不指定 communityId

      expect(response.status).toBe(201);
      expect(response.body.communityId).toBe(1); // 使用管理员的小区
    });

    it('应该处理服务器错误', async () => {
      pool.query.mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .post('/api/auth/users')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ username: 'newuser', password: 'password123', role: ROLES.SUPER_ADMIN });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('服务器内部错误，请稍后重试');
    });
  });

  describe('PUT /api/auth/users/:id', () => {
    it('应该拒绝修改自己的角色', async () => {
      const response = await request(app)
        .put('/api/auth/users/1')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ role: ROLES.COMMUNITY_ADMIN });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('不能修改自己的角色');
    });

    it('应该返回 404 如果用户不存在', async () => {
      pool.query.mockResolvedValueOnce([[]]); // 用户不存在

      const response = await request(app)
        .put('/api/auth/users/999')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ name: '测试' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('用户不存在');
    });

    it('小区管理员只能修改本小区用户', async () => {
      pool.query.mockResolvedValueOnce([[{ id: 5, username: 'other', role: ROLES.COMMUNITY_USER, community_id: 2 }]]); // 不同小区

      const response = await request(app)
        .put('/api/auth/users/5')
        .set('Authorization', `Bearer ${communityAdminToken}`)
        .send({ name: '测试' });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('只能修改本小区的用户');
    });

    it('小区管理员不能修改管理员用户', async () => {
      pool.query.mockResolvedValueOnce([[{ id: 5, username: 'cadmin2', role: ROLES.COMMUNITY_ADMIN, community_id: 1 }]]); // 同小区的管理员

      const response = await request(app)
        .put('/api/auth/users/5')
        .set('Authorization', `Bearer ${communityAdminToken}`)
        .send({ name: '测试' });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('无权修改管理员用户');
    });

    it('小区管理员不能修改用户角色', async () => {
      pool.query.mockResolvedValueOnce([[{ id: 5, username: 'user', role: ROLES.COMMUNITY_USER, community_id: 1 }]]);

      const response = await request(app)
        .put('/api/auth/users/5')
        .set('Authorization', `Bearer ${communityAdminToken}`)
        .send({ role: ROLES.COMMUNITY_ADMIN });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('小区管理员不能修改用户角色');
    });

    it('小区管理员不能将用户转移到其他小区', async () => {
      pool.query.mockResolvedValueOnce([[{ id: 5, username: 'user', role: ROLES.COMMUNITY_USER, community_id: 1 }]]);

      const response = await request(app)
        .put('/api/auth/users/5')
        .set('Authorization', `Bearer ${communityAdminToken}`)
        .send({ communityId: 2 });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('不能将用户转移到其他小区');
    });

    it('应该拒绝无效的角色类型', async () => {
      pool.query.mockResolvedValueOnce([[{ id: 5, username: 'user', role: ROLES.COMMUNITY_USER, community_id: 1 }]]);

      const response = await request(app)
        .put('/api/auth/users/5')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ role: 'invalid_role' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('无效的角色类型');
    });

    it('超级管理员应该能成功更新用户', async () => {
      pool.query
        .mockResolvedValueOnce([[{ id: 5, username: 'user', name: 'User', role: ROLES.COMMUNITY_USER, community_id: 1 }]])
        .mockResolvedValueOnce([{ affectedRows: 1 }])
        .mockResolvedValueOnce([{ insertId: 1 }]); // 记录日志

      const response = await request(app)
        .put('/api/auth/users/5')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ name: '更新后的名字' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('用户更新成功');
    });

    it('应该能更新用户密码', async () => {
      pool.query
        .mockResolvedValueOnce([[{ id: 5, username: 'user', name: 'User', role: ROLES.COMMUNITY_USER, community_id: 1 }]])
        .mockResolvedValueOnce([{ affectedRows: 1 }])
        .mockResolvedValueOnce([{ insertId: 1 }]); // 记录日志

      const response = await request(app)
        .put('/api/auth/users/5')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ password: 'newpassword123' });

      expect(response.status).toBe(200);
    });

    it('应该能将用户升级为超级管理员', async () => {
      pool.query
        .mockResolvedValueOnce([[{ id: 5, username: 'user', name: 'User', role: ROLES.COMMUNITY_USER, community_id: 1 }]])
        .mockResolvedValueOnce([{ affectedRows: 1 }])
        .mockResolvedValueOnce([{ insertId: 1 }]); // 记录日志

      const response = await request(app)
        .put('/api/auth/users/5')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ role: ROLES.SUPER_ADMIN });

      expect(response.status).toBe(200);
    });

    it('非超级管理员必须有小区', async () => {
      pool.query
        .mockResolvedValueOnce([[{ id: 5, username: 'user', name: 'User', role: ROLES.COMMUNITY_USER, community_id: null }]]);

      const response = await request(app)
        .put('/api/auth/users/5')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ role: ROLES.COMMUNITY_ADMIN });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('小区管理员和普通用户必须指定所属小区');
    });

    it('应该拒绝不存在的小区', async () => {
      pool.query
        .mockResolvedValueOnce([[{ id: 5, username: 'user', name: 'User', role: ROLES.COMMUNITY_USER, community_id: 1 }]])
        .mockResolvedValueOnce([[]]); // 小区不存在

      const response = await request(app)
        .put('/api/auth/users/5')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ communityId: 999 });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('指定的小区不存在');
    });

    it('应该处理服务器错误', async () => {
      pool.query.mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .put('/api/auth/users/5')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ name: '测试' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('服务器内部错误，请稍后重试');
    });
  });

  describe('DELETE /api/auth/users/:id', () => {
    it('应该拒绝删除自己', async () => {
      const response = await request(app)
        .delete('/api/auth/users/1')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('不能删除自己');
    });

    it('应该返回 404 如果用户不存在', async () => {
      pool.query.mockResolvedValueOnce([[]]); // 用户不存在

      const response = await request(app)
        .delete('/api/auth/users/999')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('用户不存在');
    });

    it('小区管理员只能删除本小区用户', async () => {
      pool.query.mockResolvedValueOnce([[{ id: 5, username: 'other', role: ROLES.COMMUNITY_USER, community_id: 2 }]]); // 不同小区

      const response = await request(app)
        .delete('/api/auth/users/5')
        .set('Authorization', `Bearer ${communityAdminToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('只能删除本小区的用户');
    });

    it('小区管理员不能删除管理员用户', async () => {
      pool.query.mockResolvedValueOnce([[{ id: 5, username: 'cadmin2', role: ROLES.COMMUNITY_ADMIN, community_id: 1 }]]); // 同小区的管理员

      const response = await request(app)
        .delete('/api/auth/users/5')
        .set('Authorization', `Bearer ${communityAdminToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('无权删除管理员用户');
    });

    it('超级管理员应该能成功删除用户', async () => {
      pool.query
        .mockResolvedValueOnce([[{ id: 5, username: 'user', name: 'User', role: ROLES.COMMUNITY_USER, community_id: 1 }]])
        .mockResolvedValueOnce([{ affectedRows: 1 }])
        .mockResolvedValueOnce([{ insertId: 1 }]); // 记录日志

      const response = await request(app)
        .delete('/api/auth/users/5')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('用户删除成功');
    });

    it('小区管理员应该能删除本小区普通用户', async () => {
      pool.query
        .mockResolvedValueOnce([[{ id: 5, username: 'user', name: 'User', role: ROLES.COMMUNITY_USER, community_id: 1 }]])
        .mockResolvedValueOnce([{ affectedRows: 1 }])
        .mockResolvedValueOnce([{ insertId: 1 }]); // 记录日志

      const response = await request(app)
        .delete('/api/auth/users/5')
        .set('Authorization', `Bearer ${communityAdminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('用户删除成功');
    });

    it('应该处理服务器错误', async () => {
      pool.query.mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .delete('/api/auth/users/5')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('服务器内部错误，请稍后重试');
    });
  });
});

describe('Health Check', () => {
  it('GET /api/health 应该返回 ok 状态', async () => {
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.timestamp).toBeDefined();
  });
});

describe('404 Handler', () => {
  it('应该对不存在的路由返回 404', async () => {
    const response = await request(app).get('/api/nonexistent');

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('接口不存在');
  });
});
