const request = require('supertest');

// Mock 数据库模块
jest.mock('../../src/models/db', () => require('../mocks/db'));

const { pool } = require('../../src/models/db');
const { generateToken, ROLES } = require('../../src/middleware/auth');
const { app } = require('../../src/index');

describe('Logs Routes', () => {
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

  describe('GET /api/logs', () => {
    it('应该拒绝未认证的请求', async () => {
      const response = await request(app).get('/api/logs');
      expect(response.status).toBe(401);
    });

    it('应该拒绝非超级管理员', async () => {
      const response = await request(app)
        .get('/api/logs')
        .set('Authorization', `Bearer ${communityAdminToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('需要超级管理员权限');
    });

    it('普通用户无法访问日志', async () => {
      const response = await request(app)
        .get('/api/logs')
        .set('Authorization', `Bearer ${communityUserToken}`);

      expect(response.status).toBe(403);
    });

    it('超级管理员应该能获取日志列表', async () => {
      const mockLogs = [
        { id: 1, action: 'create', module: 'owner', username: 'admin', details: '创建业主' },
        { id: 2, action: 'update', module: 'vote', username: 'admin', details: '更新投票' },
      ];
      // 第一次查询：获取总数
      pool.query.mockResolvedValueOnce([[{ total: 2 }]]);
      // 第二次查询：获取日志列表
      pool.query.mockResolvedValueOnce([mockLogs]);

      const response = await request(app)
        .get('/api/logs')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.logs).toHaveLength(2);
      expect(response.body.pagination.total).toBe(2);
    });

    it('应该支持分页', async () => {
      pool.query.mockResolvedValueOnce([[{ total: 100 }]]);
      pool.query.mockResolvedValueOnce([[{ id: 1, action: 'create' }]]);

      const response = await request(app)
        .get('/api/logs?page=2&limit=10')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.pagination.page).toBe(2);
      expect(response.body.pagination.limit).toBe(10);
    });

    it('应该支持按用户筛选', async () => {
      pool.query.mockResolvedValueOnce([[{ total: 5 }]]);
      pool.query.mockResolvedValueOnce([[{ id: 1, user_id: 1 }]]);

      const response = await request(app)
        .get('/api/logs?user_id=1')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(200);
    });

    it('应该支持按操作类型筛选', async () => {
      pool.query.mockResolvedValueOnce([[{ total: 3 }]]);
      pool.query.mockResolvedValueOnce([[{ id: 1, action: 'create' }]]);

      const response = await request(app)
        .get('/api/logs?action=create')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(200);
    });

    it('应该支持按模块筛选', async () => {
      pool.query.mockResolvedValueOnce([[{ total: 10 }]]);
      pool.query.mockResolvedValueOnce([[{ id: 1, module: 'owner' }]]);

      const response = await request(app)
        .get('/api/logs?module=owner')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(200);
    });

    it('应该支持日期范围筛选', async () => {
      pool.query.mockResolvedValueOnce([[{ total: 5 }]]);
      pool.query.mockResolvedValueOnce([[{ id: 1 }]]);

      const response = await request(app)
        .get('/api/logs?start_date=2024-01-01&end_date=2024-12-31')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(200);
    });

    it('应该支持搜索', async () => {
      pool.query.mockResolvedValueOnce([[{ total: 1 }]]);
      pool.query.mockResolvedValueOnce([[{ id: 1, details: '创建业主张三' }]]);

      const response = await request(app)
        .get('/api/logs?search=张三')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/logs/stats', () => {
    it('应该拒绝非超级管理员', async () => {
      const response = await request(app)
        .get('/api/logs/stats')
        .set('Authorization', `Bearer ${communityAdminToken}`);

      expect(response.status).toBe(403);
    });

    it('超级管理员应该能获取日志统计', async () => {
      // 操作类型统计
      pool.query.mockResolvedValueOnce([[{ action: 'create', count: 50 }, { action: 'update', count: 30 }]]);
      // 模块统计
      pool.query.mockResolvedValueOnce([[{ module: 'owner', count: 40 }, { module: 'vote', count: 20 }]]);
      // 每日统计
      pool.query.mockResolvedValueOnce([[{ date: '2024-01-01', count: 10 }]]);
      // 活跃用户统计
      pool.query.mockResolvedValueOnce([[{ username: 'admin', count: 60 }]]);

      const response = await request(app)
        .get('/api/logs/stats')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.actionStats).toBeDefined();
      expect(response.body.moduleStats).toBeDefined();
      expect(response.body.dailyStats).toBeDefined();
      expect(response.body.userStats).toBeDefined();
    });

    it('应该支持自定义天数', async () => {
      pool.query.mockResolvedValueOnce([[]]);
      pool.query.mockResolvedValueOnce([[]]);
      pool.query.mockResolvedValueOnce([[]]);
      pool.query.mockResolvedValueOnce([[]]);

      const response = await request(app)
        .get('/api/logs/stats?days=30')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/logs/filters', () => {
    it('应该拒绝非超级管理员', async () => {
      const response = await request(app)
        .get('/api/logs/filters')
        .set('Authorization', `Bearer ${communityAdminToken}`);

      expect(response.status).toBe(403);
    });

    it('超级管理员应该能获取筛选选项', async () => {
      // 操作类型
      pool.query.mockResolvedValueOnce([[{ action: 'create' }, { action: 'update' }, { action: 'delete' }]]);
      // 模块
      pool.query.mockResolvedValueOnce([[{ module: 'owner' }, { module: 'vote' }]]);
      // 用户
      pool.query.mockResolvedValueOnce([[{ user_id: 1, username: 'admin' }, { user_id: 2, username: 'user1' }]]);

      const response = await request(app)
        .get('/api/logs/filters')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.actions).toEqual(['create', 'update', 'delete']);
      expect(response.body.modules).toEqual(['owner', 'vote']);
      expect(response.body.users).toHaveLength(2);
    });
  });
});
