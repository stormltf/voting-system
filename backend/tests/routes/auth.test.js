const request = require('supertest');
const bcrypt = require('bcryptjs');

// Mock 数据库模块
jest.mock('../../src/models/db', () => require('../mocks/db'));

const { pool } = require('../../src/models/db');
const { generateToken } = require('../../src/middleware/auth');
const { app } = require('../../src/index');

describe('Auth Routes', () => {
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
        { id: 1, username: 'testuser', password: hashedPassword, role: 'admin', name: 'Test User' }
      ]]);

      const response = await request(app)
        .post('/api/auth/login')
        .send({ username: 'testuser', password: 'wrongpassword' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('用户名或密码错误');
    });

    it('应该成功登录并返回 token', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      pool.query.mockResolvedValueOnce([[
        { id: 1, username: 'admin', password: hashedPassword, role: 'admin', name: 'Admin User' }
      ]]);

      const response = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'password123' });

      expect(response.status).toBe(200);
      expect(response.body.token).toBeDefined();
      expect(response.body.user).toBeDefined();
      expect(response.body.user.username).toBe('admin');
      expect(response.body.user.password).toBeUndefined(); // 不应返回密码
    });
  });

  describe('GET /api/auth/me', () => {
    it('应该拒绝未认证的请求', async () => {
      const response = await request(app).get('/api/auth/me');

      expect(response.status).toBe(401);
    });

    it('应该返回当前用户信息', async () => {
      const token = generateToken({ id: 1, username: 'admin', role: 'admin' });
      pool.query.mockResolvedValueOnce([[
        { id: 1, username: 'admin', name: 'Admin User', role: 'admin', created_at: new Date() }
      ]]);

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.username).toBe('admin');
    });

    it('应该处理用户不存在的情况', async () => {
      const token = generateToken({ id: 999, username: 'ghost', role: 'admin' });
      pool.query.mockResolvedValueOnce([[]]);

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('用户不存在');
    });
  });

  describe('PUT /api/auth/password', () => {
    it('应该拒绝缺少旧密码或新密码', async () => {
      const token = generateToken({ id: 1, username: 'admin', role: 'admin' });

      const response = await request(app)
        .put('/api/auth/password')
        .set('Authorization', `Bearer ${token}`)
        .send({ oldPassword: '', newPassword: '' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('请提供旧密码和新密码');
    });

    it('应该拒绝错误的旧密码', async () => {
      const token = generateToken({ id: 1, username: 'admin', role: 'admin' });
      const hashedPassword = await bcrypt.hash('correctpassword', 10);
      pool.query.mockResolvedValueOnce([[
        { id: 1, username: 'admin', password: hashedPassword }
      ]]);

      const response = await request(app)
        .put('/api/auth/password')
        .set('Authorization', `Bearer ${token}`)
        .send({ oldPassword: 'wrongpassword', newPassword: 'newpassword123' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('旧密码错误');
    });

    it('应该成功修改密码', async () => {
      const token = generateToken({ id: 1, username: 'admin', role: 'admin' });
      const hashedPassword = await bcrypt.hash('oldpassword', 10);
      pool.query
        .mockResolvedValueOnce([[{ id: 1, username: 'admin', password: hashedPassword }]])
        .mockResolvedValueOnce([{ affectedRows: 1 }]);

      const response = await request(app)
        .put('/api/auth/password')
        .set('Authorization', `Bearer ${token}`)
        .send({ oldPassword: 'oldpassword', newPassword: 'newpassword123' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('密码修改成功');
    });
  });

  describe('POST /api/auth/users', () => {
    it('应该拒绝非管理员创建用户', async () => {
      const token = generateToken({ id: 2, username: 'staff', role: 'staff' });

      const response = await request(app)
        .post('/api/auth/users')
        .set('Authorization', `Bearer ${token}`)
        .send({ username: 'newuser', password: 'password123' });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('需要管理员权限');
    });

    it('应该拒绝空的用户名或密码', async () => {
      const token = generateToken({ id: 1, username: 'admin', role: 'admin' });

      const response = await request(app)
        .post('/api/auth/users')
        .set('Authorization', `Bearer ${token}`)
        .send({ username: '', password: '' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('用户名和密码不能为空');
    });

    it('管理员应该能成功创建用户', async () => {
      const token = generateToken({ id: 1, username: 'admin', role: 'admin' });
      pool.query.mockResolvedValueOnce([{ insertId: 2 }]);

      const response = await request(app)
        .post('/api/auth/users')
        .set('Authorization', `Bearer ${token}`)
        .send({ username: 'newuser', password: 'password123', name: 'New User' });

      expect(response.status).toBe(201);
      expect(response.body.id).toBe(2);
      expect(response.body.username).toBe('newuser');
    });

    it('应该拒绝重复的用户名', async () => {
      const token = generateToken({ id: 1, username: 'admin', role: 'admin' });
      const error = new Error('Duplicate entry');
      error.code = 'ER_DUP_ENTRY';
      pool.query.mockRejectedValueOnce(error);

      const response = await request(app)
        .post('/api/auth/users')
        .set('Authorization', `Bearer ${token}`)
        .send({ username: 'existinguser', password: 'password123' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('用户名已存在');
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
