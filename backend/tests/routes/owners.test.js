const request = require('supertest');

// Mock 数据库模块
jest.mock('../../src/models/db', () => require('../mocks/db'));

const { pool } = require('../../src/models/db');
const { generateToken, ROLES } = require('../../src/middleware/auth');
const { app } = require('../../src/index');

describe('Owners Routes', () => {
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

  describe('GET /api/owners', () => {
    it('应该拒绝未认证的请求', async () => {
      const response = await request(app).get('/api/owners');
      expect(response.status).toBe(401);
    });

    it('应该返回业主列表（超级管理员）', async () => {
      const mockOwners = [
        { id: 1, room_number: '01-01-0101', owner_name: '张三', phase_name: '一期' },
        { id: 2, room_number: '01-01-0102', owner_name: '李四', phase_name: '一期' },
      ];
      // 第一次查询：获取总数
      pool.query.mockResolvedValueOnce([[{ total: 2 }]]);
      // 第二次查询：获取数据
      pool.query.mockResolvedValueOnce([mockOwners]);

      const response = await request(app)
        .get('/api/owners')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.pagination.total).toBe(2);
    });

    it('应该支持分页', async () => {
      pool.query.mockResolvedValueOnce([[{ total: 100 }]]);
      pool.query.mockResolvedValueOnce([[{ id: 1, room_number: '01-01-0101' }]]);

      const response = await request(app)
        .get('/api/owners?page=2&limit=10')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.pagination.page).toBe(2);
      expect(response.body.pagination.limit).toBe(10);
    });

    it('应该支持搜索', async () => {
      pool.query.mockResolvedValueOnce([[{ total: 1 }]]);
      pool.query.mockResolvedValueOnce([[{ id: 1, room_number: '01-01-0101', owner_name: '张三' }]]);

      const response = await request(app)
        .get('/api/owners?search=张三')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(200);
    });

    it('普通用户也应该能访问业主列表', async () => {
      pool.query.mockResolvedValueOnce([[{ total: 1 }]]);
      pool.query.mockResolvedValueOnce([[{ id: 1, room_number: '01-01-0101' }]]);

      const response = await request(app)
        .get('/api/owners')
        .set('Authorization', `Bearer ${communityUserToken}`);

      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/owners/:id', () => {
    it('应该返回单个业主详情', async () => {
      const mockOwner = {
        id: 1,
        room_number: '01-01-0101',
        owner_name: '张三',
        community_id: 1
      };
      // 第一次查询：获取业主信息
      pool.query.mockResolvedValueOnce([[mockOwner]]);
      // 第二次查询：获取投票记录
      pool.query.mockResolvedValueOnce([[]]);

      const response = await request(app)
        .get('/api/owners/1')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.room_number).toBe('01-01-0101');
    });

    it('应该返回 404 如果业主不存在', async () => {
      pool.query.mockResolvedValueOnce([[]]);

      const response = await request(app)
        .get('/api/owners/999')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('业主不存在');
    });

    it('小区管理员无权访问其他小区的业主', async () => {
      const mockOwner = { id: 1, room_number: '01-01-0101', community_id: 2 }; // 不同小区
      pool.query.mockResolvedValueOnce([[mockOwner]]);

      const response = await request(app)
        .get('/api/owners/1')
        .set('Authorization', `Bearer ${communityAdminToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('无权访问该小区数据');
    });
  });

  describe('POST /api/owners', () => {
    it('应该拒绝普通用户创建业主', async () => {
      const response = await request(app)
        .post('/api/owners')
        .set('Authorization', `Bearer ${communityUserToken}`)
        .send({ phase_id: 1, room_number: '01-01-0101' });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('需要管理员权限');
    });

    it('应该拒绝空的期数或房间号', async () => {
      const response = await request(app)
        .post('/api/owners')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ phase_id: '', room_number: '' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('期数和房间号不能为空');
    });

    it('应该成功创建业主（超级管理员）', async () => {
      // 第一次查询：获取期数所属小区
      pool.query.mockResolvedValueOnce([[{ community_id: 1 }]]);
      // 第二次查询：插入业主
      pool.query.mockResolvedValueOnce([{ insertId: 1 }]);
      // 第三次查询：记录日志
      pool.query.mockResolvedValueOnce([{ insertId: 1 }]);

      const response = await request(app)
        .post('/api/owners')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          phase_id: 1,
          room_number: '01-01-0101',
          owner_name: '张三',
          area: 100.5
        });

      expect(response.status).toBe(201);
      expect(response.body.id).toBe(1);
    });

    it('小区管理员应该能创建本小区的业主', async () => {
      // 第一次查询：获取期数所属小区 (community_id: 1 与管理员的小区匹配)
      pool.query.mockResolvedValueOnce([[{ community_id: 1 }]]);
      // 第二次查询：插入业主
      pool.query.mockResolvedValueOnce([{ insertId: 2 }]);
      // 第三次查询：记录日志
      pool.query.mockResolvedValueOnce([{ insertId: 1 }]);

      const response = await request(app)
        .post('/api/owners')
        .set('Authorization', `Bearer ${communityAdminToken}`)
        .send({
          phase_id: 1,
          room_number: '01-01-0102',
          owner_name: '李四'
        });

      expect(response.status).toBe(201);
    });

    it('小区管理员无法创建其他小区的业主', async () => {
      // 期数属于其他小区
      pool.query.mockResolvedValueOnce([[{ community_id: 2 }]]);

      const response = await request(app)
        .post('/api/owners')
        .set('Authorization', `Bearer ${communityAdminToken}`)
        .send({
          phase_id: 5,
          room_number: '01-01-0101'
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('无权管理该小区数据');
    });

    it('应该拒绝重复的房间号', async () => {
      pool.query.mockResolvedValueOnce([[{ community_id: 1 }]]);
      const error = new Error('Duplicate entry');
      error.code = 'ER_DUP_ENTRY';
      pool.query.mockRejectedValueOnce(error);

      const response = await request(app)
        .post('/api/owners')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ phase_id: 1, room_number: '01-01-0101' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('该房间号已存在');
    });
  });

  describe('PUT /api/owners/:id', () => {
    it('应该成功更新业主', async () => {
      // 第一次查询：获取业主所属小区
      pool.query.mockResolvedValueOnce([[{ community_id: 1 }]]);
      // 第二次查询：更新业主
      pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
      // 第三次查询：获取更新后的业主信息
      pool.query.mockResolvedValueOnce([[{ room_number: '01-01-0101', owner_name: '张三更新' }]]);
      // 第四次查询：记录日志
      pool.query.mockResolvedValueOnce([{ insertId: 1 }]);

      const response = await request(app)
        .put('/api/owners/1')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ owner_name: '张三更新', phone1: '13800138000' });

      expect(response.status).toBe(200);
      expect(response.body.owner_name).toBe('张三更新');
    });

    it('应该返回 404 如果业主不存在', async () => {
      pool.query.mockResolvedValueOnce([[]]);

      const response = await request(app)
        .put('/api/owners/999')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ owner_name: '测试' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('业主不存在');
    });

    it('应该拒绝没有更新字段的请求', async () => {
      pool.query.mockResolvedValueOnce([[{ community_id: 1 }]]);

      const response = await request(app)
        .put('/api/owners/1')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('没有要更新的字段');
    });
  });

  describe('DELETE /api/owners/:id', () => {
    it('应该成功删除业主', async () => {
      // 第一次查询：获取业主所属小区
      pool.query.mockResolvedValueOnce([[{ community_id: 1 }]]);
      // 第二次查询：获取要删除的业主信息
      pool.query.mockResolvedValueOnce([[{ room_number: '01-01-0101', owner_name: '张三' }]]);
      // 第三次查询：删除业主
      pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
      // 第四次查询：记录日志
      pool.query.mockResolvedValueOnce([{ insertId: 1 }]);

      const response = await request(app)
        .delete('/api/owners/1')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('删除成功');
    });

    it('应该返回 404 如果业主不存在', async () => {
      pool.query.mockResolvedValueOnce([[]]);

      const response = await request(app)
        .delete('/api/owners/999')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('业主不存在');
    });
  });

  describe('GET /api/owners/buildings/:phaseId', () => {
    it('应该返回楼栋列表', async () => {
      // 第一次查询：获取期数所属小区
      pool.query.mockResolvedValueOnce([[{ community_id: 1 }]]);
      // 第二次查询：获取楼栋列表
      pool.query.mockResolvedValueOnce([[{ building: '01' }, { building: '02' }, { building: '03' }]]);

      const response = await request(app)
        .get('/api/owners/buildings/1')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(['01', '02', '03']);
    });

    it('应该返回 404 如果期数不存在', async () => {
      pool.query.mockResolvedValueOnce([[]]);

      const response = await request(app)
        .get('/api/owners/buildings/999')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('期数不存在');
    });
  });

  describe('GET /api/owners/units/:phaseId/:building', () => {
    it('应该返回单元列表', async () => {
      // 第一次查询：获取期数所属小区
      pool.query.mockResolvedValueOnce([[{ community_id: 1 }]]);
      // 第二次查询：获取单元列表
      pool.query.mockResolvedValueOnce([[{ unit: '01' }, { unit: '02' }]]);

      const response = await request(app)
        .get('/api/owners/units/1/01')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(['01', '02']);
    });
  });
});
