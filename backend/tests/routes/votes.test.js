const request = require('supertest');

// Mock 数据库模块
jest.mock('../../src/models/db', () => require('../mocks/db'));

const { pool } = require('../../src/models/db');
const { generateToken, ROLES } = require('../../src/middleware/auth');
const { app } = require('../../src/index');

describe('Votes Routes', () => {
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

  describe('Vote Rounds', () => {
    describe('GET /api/votes/rounds', () => {
      it('应该拒绝未认证的请求', async () => {
        const response = await request(app).get('/api/votes/rounds');
        expect(response.status).toBe(401);
      });

      it('应该返回投票轮次列表（超级管理员）', async () => {
        const mockRounds = [
          { id: 1, name: '2024年第一次业主大会', year: 2024, community_name: '阳光花园' },
          { id: 2, name: '2024年第二次业主大会', year: 2024, community_name: '绿地小区' },
        ];
        pool.query.mockResolvedValueOnce([mockRounds]);

        const response = await request(app)
          .get('/api/votes/rounds')
          .set('Authorization', `Bearer ${superAdminToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(2);
      });

      it('普通用户可以查看本小区的投票轮次', async () => {
        const mockRounds = [{ id: 1, name: '2024年第一次业主大会', year: 2024 }];
        pool.query.mockResolvedValueOnce([mockRounds]);

        const response = await request(app)
          .get('/api/votes/rounds')
          .set('Authorization', `Bearer ${communityUserToken}`);

        expect(response.status).toBe(200);
      });
    });

    describe('GET /api/votes/rounds/:id', () => {
      it('应该返回单个投票轮次', async () => {
        const mockRound = { id: 1, name: '2024年第一次业主大会', year: 2024, community_id: 1 };
        pool.query.mockResolvedValueOnce([[mockRound]]);

        const response = await request(app)
          .get('/api/votes/rounds/1')
          .set('Authorization', `Bearer ${superAdminToken}`);

        expect(response.status).toBe(200);
        expect(response.body.name).toBe('2024年第一次业主大会');
      });

      it('应该返回 404 如果轮次不存在', async () => {
        pool.query.mockResolvedValueOnce([[]]);

        const response = await request(app)
          .get('/api/votes/rounds/999')
          .set('Authorization', `Bearer ${superAdminToken}`);

        expect(response.status).toBe(404);
        expect(response.body.error).toBe('投票轮次不存在');
      });

      it('小区管理员无权访问其他小区的投票轮次', async () => {
        const mockRound = { id: 1, name: '测试', community_id: 2 }; // 不同小区
        pool.query.mockResolvedValueOnce([[mockRound]]);

        const response = await request(app)
          .get('/api/votes/rounds/1')
          .set('Authorization', `Bearer ${communityAdminToken}`);

        expect(response.status).toBe(403);
        expect(response.body.error).toBe('无权访问该投票轮次');
      });
    });

    describe('POST /api/votes/rounds', () => {
      it('应该拒绝普通用户创建投票轮次', async () => {
        const response = await request(app)
          .post('/api/votes/rounds')
          .set('Authorization', `Bearer ${communityUserToken}`)
          .send({ community_id: 1, name: '测试', year: 2024 });

        expect(response.status).toBe(403);
        expect(response.body.error).toBe('需要管理员权限');
      });

      it('应该拒绝空的小区ID', async () => {
        const response = await request(app)
          .post('/api/votes/rounds')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .send({ name: '测试', year: 2024 });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('请选择小区');
      });

      it('应该拒绝空的名称或年份', async () => {
        const response = await request(app)
          .post('/api/votes/rounds')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .send({ community_id: 1, name: '', year: '' });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('投票名称和年份不能为空');
      });

      it('应该成功创建投票轮次（超级管理员）', async () => {
        // 第一次查询：插入投票轮次
        pool.query.mockResolvedValueOnce([{ insertId: 1 }]);
        // 第二次查询：记录日志
        pool.query.mockResolvedValueOnce([{ insertId: 1 }]);

        const response = await request(app)
          .post('/api/votes/rounds')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .send({
            community_id: 1,
            name: '2024年第一次业主大会',
            year: 2024,
            round_code: 'A',
            status: 'active'
          });

        expect(response.status).toBe(201);
        expect(response.body.id).toBe(1);
        expect(response.body.name).toBe('2024年第一次业主大会');
      });

      it('小区管理员应该能创建本小区的投票轮次', async () => {
        pool.query.mockResolvedValueOnce([{ insertId: 2 }]);
        pool.query.mockResolvedValueOnce([{ insertId: 1 }]);

        const response = await request(app)
          .post('/api/votes/rounds')
          .set('Authorization', `Bearer ${communityAdminToken}`)
          .send({
            community_id: 1,
            name: '2024年业主大会',
            year: 2024
          });

        expect(response.status).toBe(201);
      });

      it('小区管理员无法创建其他小区的投票轮次', async () => {
        const response = await request(app)
          .post('/api/votes/rounds')
          .set('Authorization', `Bearer ${communityAdminToken}`)
          .send({
            community_id: 2, // 不同小区
            name: '测试',
            year: 2024
          });

        expect(response.status).toBe(403);
        expect(response.body.error).toBe('无权管理该小区');
      });
    });

    describe('PUT /api/votes/rounds/:id', () => {
      it('应该成功更新投票轮次', async () => {
        // 第一次查询：获取轮次所属小区
        pool.query.mockResolvedValueOnce([[{ community_id: 1 }]]);
        // 第二次查询：更新轮次
        pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
        // 第三次查询：记录日志
        pool.query.mockResolvedValueOnce([{ insertId: 1 }]);

        const response = await request(app)
          .put('/api/votes/rounds/1')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .send({
            name: '2024年业主大会（更新）',
            year: 2024,
            status: 'completed'
          });

        expect(response.status).toBe(200);
        expect(response.body.name).toBe('2024年业主大会（更新）');
      });

      it('应该返回 404 如果轮次不存在', async () => {
        pool.query.mockResolvedValueOnce([[]]);

        const response = await request(app)
          .put('/api/votes/rounds/999')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .send({ name: '测试', year: 2024 });

        expect(response.status).toBe(404);
        expect(response.body.error).toBe('投票轮次不存在');
      });
    });

    describe('DELETE /api/votes/rounds/:id', () => {
      it('应该成功删除投票轮次', async () => {
        // 第一次查询：获取轮次信息
        pool.query.mockResolvedValueOnce([[{ id: 1, name: '测试轮次', year: 2024, community_id: 1 }]]);
        // 第二次查询：删除轮次
        pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
        // 第三次查询：记录日志
        pool.query.mockResolvedValueOnce([{ insertId: 1 }]);

        const response = await request(app)
          .delete('/api/votes/rounds/1')
          .set('Authorization', `Bearer ${superAdminToken}`);

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('删除成功');
      });

      it('应该返回 404 如果轮次不存在', async () => {
        pool.query.mockResolvedValueOnce([[]]);

        const response = await request(app)
          .delete('/api/votes/rounds/999')
          .set('Authorization', `Bearer ${superAdminToken}`);

        expect(response.status).toBe(404);
        expect(response.body.error).toBe('投票轮次不存在');
      });
    });
  });

  describe('Vote Records', () => {
    describe('GET /api/votes', () => {
      it('应该返回投票记录列表', async () => {
        const mockVotes = [
          { id: 1, owner_id: 1, round_id: 1, vote_status: 'voted', room_number: '01-01-0101' },
          { id: 2, owner_id: 2, round_id: 1, vote_status: 'pending', room_number: '01-01-0102' },
        ];
        // 第一次查询：获取总数
        pool.query.mockResolvedValueOnce([[{ total: 2 }]]);
        // 第二次查询：获取数据
        pool.query.mockResolvedValueOnce([mockVotes]);

        const response = await request(app)
          .get('/api/votes')
          .set('Authorization', `Bearer ${superAdminToken}`);

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(2);
        expect(response.body.pagination.total).toBe(2);
      });

      it('应该支持按投票状态筛选', async () => {
        pool.query.mockResolvedValueOnce([[{ total: 1 }]]);
        pool.query.mockResolvedValueOnce([[{ id: 1, vote_status: 'voted' }]]);

        const response = await request(app)
          .get('/api/votes?vote_status=voted')
          .set('Authorization', `Bearer ${superAdminToken}`);

        expect(response.status).toBe(200);
      });
    });

    describe('POST /api/votes', () => {
      it('应该拒绝空的业主ID或轮次ID', async () => {
        const response = await request(app)
          .post('/api/votes')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .send({ owner_id: '', round_id: '' });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('业主ID和投票轮次不能为空');
      });

      it('应该拒绝不存在的投票轮次', async () => {
        pool.query.mockResolvedValueOnce([[]]);

        const response = await request(app)
          .post('/api/votes')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .send({ owner_id: 1, round_id: 999 });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('投票轮次不存在');
      });

      it('应该成功创建投票记录', async () => {
        // 第一次查询：获取轮次所属小区
        pool.query.mockResolvedValueOnce([[{ community_id: 1 }]]);
        // 第二次查询：插入投票记录
        pool.query.mockResolvedValueOnce([{ insertId: 1 }]);
        // 第三次查询：获取业主信息
        pool.query.mockResolvedValueOnce([[{ room_number: '01-01-0101' }]]);
        // 第四次查询：记录日志
        pool.query.mockResolvedValueOnce([{ insertId: 1 }]);

        const response = await request(app)
          .post('/api/votes')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .send({
            owner_id: 1,
            round_id: 1,
            vote_status: 'voted',
            vote_date: '2024-01-01'
          });

        expect(response.status).toBe(200);
        expect(response.body.vote_status).toBe('voted');
      });
    });

    describe('PUT /api/votes/batch', () => {
      it('应该拒绝空的业主列表', async () => {
        const response = await request(app)
          .put('/api/votes/batch')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .send({ owner_ids: [], round_id: 1 });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('请选择业主');
      });

      it('应该拒绝空的轮次ID', async () => {
        const response = await request(app)
          .put('/api/votes/batch')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .send({ owner_ids: [1, 2, 3] });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('请选择投票轮次');
      });

      it('应该成功批量更新投票状态', async () => {
        // 第一次查询：获取轮次所属小区
        pool.query.mockResolvedValueOnce([[{ community_id: 1 }]]);
        // 第二次查询：验证业主是否属于该小区
        pool.query.mockResolvedValueOnce([[{ count: 3 }]]);
        // 第三次查询：批量插入/更新
        pool.query.mockResolvedValueOnce([{ affectedRows: 3 }]);
        // 第四次查询：记录日志
        pool.query.mockResolvedValueOnce([{ insertId: 1 }]);

        const response = await request(app)
          .put('/api/votes/batch')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .send({
            owner_ids: [1, 2, 3],
            round_id: 1,
            vote_status: 'voted'
          });

        expect(response.status).toBe(200);
        expect(response.body.message).toContain('成功更新');
      });

      it('应该拒绝包含无效业主的请求', async () => {
        pool.query.mockResolvedValueOnce([[{ community_id: 1 }]]);
        // 只有2个有效业主，但请求了3个
        pool.query.mockResolvedValueOnce([[{ count: 2 }]]);

        const response = await request(app)
          .put('/api/votes/batch')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .send({
            owner_ids: [1, 2, 999],
            round_id: 1,
            vote_status: 'voted'
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('包含无效的业主ID或非本小区的业主');
      });
    });

    describe('POST /api/votes/init', () => {
      it('应该拒绝空的轮次ID或小区ID', async () => {
        const response = await request(app)
          .post('/api/votes/init')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .send({ round_id: '', community_id: '' });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('请选择投票轮次和小区');
      });

      it('应该成功初始化投票记录', async () => {
        // 第一次查询：初始化投票记录
        pool.query.mockResolvedValueOnce([{ affectedRows: 100 }]);
        // 第二次查询：获取业主总数
        pool.query.mockResolvedValueOnce([[{ total: 100 }]]);
        // 第三次查询：记录日志
        pool.query.mockResolvedValueOnce([{ insertId: 1 }]);

        const response = await request(app)
          .post('/api/votes/init')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .send({ round_id: 1, community_id: 1 });

        expect(response.status).toBe(200);
        expect(response.body.created).toBe(100);
        expect(response.body.total).toBe(100);
      });
    });
  });
});
