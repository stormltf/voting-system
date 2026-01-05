const request = require('supertest');
const XLSX = require('xlsx');

// Mock 数据库模块
jest.mock('../../src/models/db', () => require('../mocks/db'));

const { pool } = require('../../src/models/db');
const { generateToken, ROLES } = require('../../src/middleware/auth');
const { app } = require('../../src/index');

// Helper function to create Excel buffer for testing
function createExcelBuffer(data, sheetName = 'Sheet1') {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_array ? XLSX.utils.aoa_to_arr(data) : XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

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

      it('超级管理员可以按小区筛选投票轮次', async () => {
        const mockRounds = [{ id: 1, name: '2024年第一次业主大会', year: 2024 }];
        pool.query.mockResolvedValueOnce([mockRounds]);

        const response = await request(app)
          .get('/api/votes/rounds?community_id=1')
          .set('Authorization', `Bearer ${superAdminToken}`);

        expect(response.status).toBe(200);
      });

      it('普通用户可以查看本小区的投票轮次', async () => {
        const mockRounds = [{ id: 1, name: '2024年第一次业主大会', year: 2024 }];
        pool.query.mockResolvedValueOnce([mockRounds]);

        const response = await request(app)
          .get('/api/votes/rounds')
          .set('Authorization', `Bearer ${communityUserToken}`);

        expect(response.status).toBe(200);
      });

      it('应该处理服务器错误', async () => {
        pool.query.mockRejectedValueOnce(new Error('Database error'));

        const response = await request(app)
          .get('/api/votes/rounds')
          .set('Authorization', `Bearer ${superAdminToken}`);

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('服务器错误');
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

      it('应该处理服务器错误', async () => {
        pool.query.mockRejectedValueOnce(new Error('Database error'));

        const response = await request(app)
          .get('/api/votes/rounds/1')
          .set('Authorization', `Bearer ${superAdminToken}`);

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('服务器错误');
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

      it('应该处理服务器错误', async () => {
        pool.query.mockRejectedValueOnce(new Error('Database error'));

        const response = await request(app)
          .post('/api/votes/rounds')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .send({ community_id: 1, name: '测试', year: 2024 });

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('服务器错误');
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

      it('小区管理员无权更新其他小区的投票轮次', async () => {
        pool.query.mockResolvedValueOnce([[{ community_id: 2 }]]); // 不同小区

        const response = await request(app)
          .put('/api/votes/rounds/1')
          .set('Authorization', `Bearer ${communityAdminToken}`)
          .send({ name: '测试', year: 2024 });

        expect(response.status).toBe(403);
        expect(response.body.error).toBe('无权管理该投票轮次');
      });

      it('应该处理服务器错误', async () => {
        pool.query.mockRejectedValueOnce(new Error('Database error'));

        const response = await request(app)
          .put('/api/votes/rounds/1')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .send({ name: '测试', year: 2024 });

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('服务器错误');
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

      it('小区管理员无权删除其他小区的投票轮次', async () => {
        pool.query.mockResolvedValueOnce([[{ id: 1, name: '测试', community_id: 2 }]]);

        const response = await request(app)
          .delete('/api/votes/rounds/1')
          .set('Authorization', `Bearer ${communityAdminToken}`);

        expect(response.status).toBe(403);
        expect(response.body.error).toBe('无权删除该投票轮次');
      });

      it('应该处理服务器错误', async () => {
        pool.query.mockRejectedValueOnce(new Error('Database error'));

        const response = await request(app)
          .delete('/api/votes/rounds/1')
          .set('Authorization', `Bearer ${superAdminToken}`);

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('服务器错误');
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

      it('应该支持按轮次筛选', async () => {
        pool.query.mockResolvedValueOnce([[{ total: 1 }]]);
        pool.query.mockResolvedValueOnce([[{ id: 1, round_id: 1 }]]);

        const response = await request(app)
          .get('/api/votes?round_id=1')
          .set('Authorization', `Bearer ${superAdminToken}`);

        expect(response.status).toBe(200);
      });

      it('应该支持按期数筛选', async () => {
        pool.query.mockResolvedValueOnce([[{ total: 1 }]]);
        pool.query.mockResolvedValueOnce([[{ id: 1, phase_id: 1 }]]);

        const response = await request(app)
          .get('/api/votes?phase_id=1')
          .set('Authorization', `Bearer ${superAdminToken}`);

        expect(response.status).toBe(200);
      });

      it('应该支持搜索', async () => {
        pool.query.mockResolvedValueOnce([[{ total: 1 }]]);
        pool.query.mockResolvedValueOnce([[{ id: 1, room_number: '01-01-0101' }]]);

        const response = await request(app)
          .get('/api/votes?search=0101')
          .set('Authorization', `Bearer ${superAdminToken}`);

        expect(response.status).toBe(200);
      });

      it('普通用户只能查看本小区的投票记录', async () => {
        pool.query.mockResolvedValueOnce([[{ total: 1 }]]);
        pool.query.mockResolvedValueOnce([[{ id: 1, vote_status: 'voted' }]]);

        const response = await request(app)
          .get('/api/votes')
          .set('Authorization', `Bearer ${communityUserToken}`);

        expect(response.status).toBe(200);
      });

      it('超级管理员可以按小区筛选', async () => {
        pool.query.mockResolvedValueOnce([[{ total: 1 }]]);
        pool.query.mockResolvedValueOnce([[{ id: 1, community_id: 1 }]]);

        const response = await request(app)
          .get('/api/votes?community_id=1')
          .set('Authorization', `Bearer ${superAdminToken}`);

        expect(response.status).toBe(200);
      });

      it('应该处理服务器错误', async () => {
        pool.query.mockRejectedValueOnce(new Error('Database error'));

        const response = await request(app)
          .get('/api/votes')
          .set('Authorization', `Bearer ${superAdminToken}`);

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('服务器错误');
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

      it('小区管理员无权管理其他小区的投票记录', async () => {
        pool.query.mockResolvedValueOnce([[{ community_id: 2 }]]); // 不同小区

        const response = await request(app)
          .post('/api/votes')
          .set('Authorization', `Bearer ${communityAdminToken}`)
          .send({ owner_id: 1, round_id: 1, vote_status: 'voted' });

        expect(response.status).toBe(403);
        expect(response.body.error).toBe('无权管理该投票轮次');
      });

      it('应该处理服务器错误', async () => {
        pool.query.mockRejectedValueOnce(new Error('Database error'));

        const response = await request(app)
          .post('/api/votes')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .send({ owner_id: 1, round_id: 1, vote_status: 'voted' });

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('服务器错误');
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

      it('应该拒绝非数组的业主列表', async () => {
        const response = await request(app)
          .put('/api/votes/batch')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .send({ owner_ids: 'not-array', round_id: 1 });

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

      it('应该拒绝不存在的投票轮次', async () => {
        pool.query.mockResolvedValueOnce([[]]); // 轮次不存在

        const response = await request(app)
          .put('/api/votes/batch')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .send({ owner_ids: [1, 2], round_id: 999 });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('投票轮次不存在');
      });

      it('小区管理员无权批量更新其他小区的投票', async () => {
        pool.query.mockResolvedValueOnce([[{ community_id: 2 }]]); // 不同小区

        const response = await request(app)
          .put('/api/votes/batch')
          .set('Authorization', `Bearer ${communityAdminToken}`)
          .send({ owner_ids: [1, 2], round_id: 1, vote_status: 'voted' });

        expect(response.status).toBe(403);
        expect(response.body.error).toBe('无权管理该投票轮次');
      });

      it('应该处理服务器错误', async () => {
        pool.query.mockRejectedValueOnce(new Error('Database error'));

        const response = await request(app)
          .put('/api/votes/batch')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .send({ owner_ids: [1, 2], round_id: 1, vote_status: 'voted' });

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('服务器错误');
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

      it('小区管理员无权初始化其他小区的投票', async () => {
        const response = await request(app)
          .post('/api/votes/init')
          .set('Authorization', `Bearer ${communityAdminToken}`)
          .send({ round_id: 1, community_id: 2 }); // 不同小区

        expect(response.status).toBe(403);
        expect(response.body.error).toBe('无权管理该小区');
      });

      it('应该处理服务器错误', async () => {
        pool.query.mockRejectedValueOnce(new Error('Database error'));

        const response = await request(app)
          .post('/api/votes/init')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .send({ round_id: 1, community_id: 1 });

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('服务器错误');
      });
    });
  });

  describe('Vote Statistics', () => {
    describe('GET /api/votes/stats', () => {
      it('应该返回投票统计数据', async () => {
        // 第一次查询：总业主数和面积
        pool.query.mockResolvedValueOnce([[{ total_owners: 100, total_area: 10000, total_parking_area: 500 }]]);
        // 第二次查询：按期数统计
        pool.query.mockResolvedValueOnce([[]]);

        const response = await request(app)
          .get('/api/votes/stats')
          .set('Authorization', `Bearer ${superAdminToken}`);

        expect(response.status).toBe(200);
        expect(response.body.total.total_owners).toBe(100);
      });

      it('应该支持按轮次统计', async () => {
        pool.query.mockResolvedValueOnce([[{ total_owners: 100, total_area: 10000, total_parking_area: 500 }]]);
        pool.query.mockResolvedValueOnce([[{ voted_count: 50, refused_count: 5, pending_count: 45 }]]);
        pool.query.mockResolvedValueOnce([[]]);

        const response = await request(app)
          .get('/api/votes/stats?round_id=1')
          .set('Authorization', `Bearer ${superAdminToken}`);

        expect(response.status).toBe(200);
        expect(response.body.voteStats).toBeDefined();
      });

      it('应该支持按小区筛选', async () => {
        pool.query.mockResolvedValueOnce([[{ total_owners: 50, total_area: 5000, total_parking_area: 250 }]]);
        pool.query.mockResolvedValueOnce([[]]); // 按期数统计
        pool.query.mockResolvedValueOnce([[]]); // 按楼栋统计（当指定了 community_id 时会查询）

        const response = await request(app)
          .get('/api/votes/stats?community_id=1')
          .set('Authorization', `Bearer ${superAdminToken}`);

        expect(response.status).toBe(200);
      });

      it('应该支持按期数筛选', async () => {
        pool.query.mockResolvedValueOnce([[{ total_owners: 30, total_area: 3000, total_parking_area: 150 }]]);
        pool.query.mockResolvedValueOnce([[]]);
        pool.query.mockResolvedValueOnce([[]]);

        const response = await request(app)
          .get('/api/votes/stats?phase_id=1&community_id=1')
          .set('Authorization', `Bearer ${superAdminToken}`);

        expect(response.status).toBe(200);
      });

      it('普通用户只能查看本小区的统计', async () => {
        pool.query.mockResolvedValueOnce([[{ total_owners: 50, total_area: 5000, total_parking_area: 250 }]]);
        pool.query.mockResolvedValueOnce([[]]);

        const response = await request(app)
          .get('/api/votes/stats')
          .set('Authorization', `Bearer ${communityUserToken}`);

        expect(response.status).toBe(200);
      });

      it('应该处理服务器错误', async () => {
        pool.query.mockRejectedValueOnce(new Error('Database error'));

        const response = await request(app)
          .get('/api/votes/stats')
          .set('Authorization', `Bearer ${superAdminToken}`);

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('服务器错误');
      });
    });

    describe('GET /api/votes/progress', () => {
      it('应该返回投票进度', async () => {
        const mockProgress = [
          { round_id: 1, round_name: '2024年业主大会', total_owners: 100, voted_count: 50 }
        ];
        pool.query.mockResolvedValueOnce([mockProgress]);

        const response = await request(app)
          .get('/api/votes/progress')
          .set('Authorization', `Bearer ${superAdminToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(1);
      });

      it('应该支持按小区筛选', async () => {
        pool.query.mockResolvedValueOnce([[{ round_id: 1, total_owners: 50 }]]);

        const response = await request(app)
          .get('/api/votes/progress?community_id=1')
          .set('Authorization', `Bearer ${superAdminToken}`);

        expect(response.status).toBe(200);
      });

      it('普通用户只能查看本小区的进度', async () => {
        pool.query.mockResolvedValueOnce([[{ round_id: 1, total_owners: 50 }]]);

        const response = await request(app)
          .get('/api/votes/progress')
          .set('Authorization', `Bearer ${communityUserToken}`);

        expect(response.status).toBe(200);
      });

      it('应该处理服务器错误', async () => {
        pool.query.mockRejectedValueOnce(new Error('Database error'));

        const response = await request(app)
          .get('/api/votes/progress')
          .set('Authorization', `Bearer ${superAdminToken}`);

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('服务器错误');
      });
    });
  });

  describe('Building Visualization', () => {
    describe('GET /api/votes/unit-rooms', () => {
      it('应该返回单元房间数据', async () => {
        const mockRooms = [
          { owner_id: 1, room_number: '01-01-0101', room: '0101', vote_status: 'voted', phase_name: '一期', round_name: '2024' }
        ];
        pool.query.mockResolvedValueOnce([mockRooms]);

        const response = await request(app)
          .get('/api/votes/unit-rooms?round_id=1&phase_id=1&building=01&unit=01')
          .set('Authorization', `Bearer ${superAdminToken}`);

        expect(response.status).toBe(200);
        expect(response.body.meta).toBeDefined();
        expect(response.body.floors).toBeDefined();
      });

      it('应该拒绝缺少必要参数的请求', async () => {
        const response = await request(app)
          .get('/api/votes/unit-rooms?round_id=1')
          .set('Authorization', `Bearer ${superAdminToken}`);

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('缺少必要参数: round_id, phase_id, building, unit');
      });

      it('应该处理空数据', async () => {
        pool.query.mockResolvedValueOnce([[]]);

        const response = await request(app)
          .get('/api/votes/unit-rooms?round_id=1&phase_id=1&building=99&unit=99')
          .set('Authorization', `Bearer ${superAdminToken}`);

        expect(response.status).toBe(200);
        expect(response.body.meta.total_rooms).toBe(0);
      });

      it('应该正确解析楼层信息', async () => {
        const mockRooms = [
          { owner_id: 1, room_number: '01-01-0101', room: '101', vote_status: 'voted', phase_name: '一期', round_name: '2024' },
          { owner_id: 2, room_number: '01-01-0201', room: '201', vote_status: 'pending', phase_name: '一期', round_name: '2024' },
        ];
        pool.query.mockResolvedValueOnce([mockRooms]);

        const response = await request(app)
          .get('/api/votes/unit-rooms?round_id=1&phase_id=1&building=01&unit=01')
          .set('Authorization', `Bearer ${superAdminToken}`);

        expect(response.status).toBe(200);
        expect(response.body.stats.max_floor).toBeGreaterThan(0);
      });

      it('应该处理服务器错误', async () => {
        pool.query.mockRejectedValueOnce(new Error('Database error'));

        const response = await request(app)
          .get('/api/votes/unit-rooms?round_id=1&phase_id=1&building=01&unit=01')
          .set('Authorization', `Bearer ${superAdminToken}`);

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('服务器错误');
      });
    });

    describe('GET /api/votes/building-overview', () => {
      it('应该返回楼栋概览', async () => {
        // 第一次查询：获取最近的轮次
        pool.query.mockResolvedValueOnce([[{ id: 1 }]]);
        // 第二次查询：获取轮次信息
        pool.query.mockResolvedValueOnce([[{ id: 1, name: '2024业主大会', status: 'active' }]]);
        // 第三次查询：获取统计
        pool.query.mockResolvedValueOnce([[{ phase_id: 1, phase_name: '一期', building: '01', unit: '01', total_rooms: 10 }]]);

        const response = await request(app)
          .get('/api/votes/building-overview?community_id=1')
          .set('Authorization', `Bearer ${superAdminToken}`);

        expect(response.status).toBe(200);
        expect(response.body.round).toBeDefined();
        expect(response.body.phases).toBeDefined();
      });

      it('应该拒绝缺少小区ID的请求', async () => {
        const response = await request(app)
          .get('/api/votes/building-overview')
          .set('Authorization', `Bearer ${superAdminToken}`);

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('缺少必要参数: community_id');
      });

      it('应该处理没有投票轮次的情况', async () => {
        pool.query.mockResolvedValueOnce([[]]); // 没有轮次

        const response = await request(app)
          .get('/api/votes/building-overview?community_id=1')
          .set('Authorization', `Bearer ${superAdminToken}`);

        expect(response.status).toBe(200);
        expect(response.body.round).toBeNull();
      });

      it('应该支持指定轮次', async () => {
        pool.query.mockResolvedValueOnce([[{ id: 1, name: '2024业主大会', status: 'active' }]]);
        pool.query.mockResolvedValueOnce([[{ phase_id: 1, phase_name: '一期', building: '01', unit: '01', total_rooms: 10 }]]);

        const response = await request(app)
          .get('/api/votes/building-overview?community_id=1&round_id=1')
          .set('Authorization', `Bearer ${superAdminToken}`);

        expect(response.status).toBe(200);
      });

      it('应该处理轮次不存在的情况', async () => {
        pool.query.mockResolvedValueOnce([[]]); // 轮次不存在

        const response = await request(app)
          .get('/api/votes/building-overview?community_id=1&round_id=999')
          .set('Authorization', `Bearer ${superAdminToken}`);

        expect(response.status).toBe(200);
        expect(response.body.round).toBeNull();
      });

      it('应该处理服务器错误', async () => {
        pool.query.mockRejectedValueOnce(new Error('Database error'));

        const response = await request(app)
          .get('/api/votes/building-overview?community_id=1')
          .set('Authorization', `Bearer ${superAdminToken}`);

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('服务器错误');
      });
    });
  });

  describe('Sweep Status Management', () => {
    describe('GET /api/votes/sweep-overview', () => {
      it('应该返回扫楼概览', async () => {
        pool.query.mockResolvedValueOnce([[{ id: 1 }]]); // 最近轮次
        pool.query.mockResolvedValueOnce([[{ id: 1, name: '2024', status: 'active' }]]); // 轮次信息
        pool.query.mockResolvedValueOnce([[{ phase_id: 1, phase_name: '一期', building: '01', unit: '01', total_rooms: 10, completed_count: 5 }]]);

        const response = await request(app)
          .get('/api/votes/sweep-overview?community_id=1')
          .set('Authorization', `Bearer ${superAdminToken}`);

        expect(response.status).toBe(200);
        expect(response.body.phases).toBeDefined();
      });

      it('应该拒绝缺少小区ID的请求', async () => {
        const response = await request(app)
          .get('/api/votes/sweep-overview')
          .set('Authorization', `Bearer ${superAdminToken}`);

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('缺少必要参数: community_id');
      });

      it('小区管理员无权访问其他小区的扫楼概览', async () => {
        const response = await request(app)
          .get('/api/votes/sweep-overview?community_id=2')
          .set('Authorization', `Bearer ${communityAdminToken}`);

        expect(response.status).toBe(403);
        expect(response.body.error).toBe('无权访问该小区');
      });

      it('应该处理没有轮次的情况', async () => {
        pool.query.mockResolvedValueOnce([[]]);

        const response = await request(app)
          .get('/api/votes/sweep-overview?community_id=1')
          .set('Authorization', `Bearer ${superAdminToken}`);

        expect(response.status).toBe(200);
        expect(response.body.round).toBeNull();
      });

      it('应该处理服务器错误', async () => {
        pool.query.mockRejectedValueOnce(new Error('Database error'));

        const response = await request(app)
          .get('/api/votes/sweep-overview?community_id=1')
          .set('Authorization', `Bearer ${superAdminToken}`);

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('服务器错误');
      });
    });

    describe('GET /api/votes/sweep-unit-rooms', () => {
      it('应该返回单元扫楼数据', async () => {
        const mockRooms = [
          { owner_id: 1, room_number: '01-01-0101', room: '0101', sweep_status: 'completed', phase_name: '一期', round_name: '2024' }
        ];
        pool.query.mockResolvedValueOnce([mockRooms]);

        const response = await request(app)
          .get('/api/votes/sweep-unit-rooms?round_id=1&phase_id=1&building=01&unit=01')
          .set('Authorization', `Bearer ${superAdminToken}`);

        expect(response.status).toBe(200);
        expect(response.body.meta).toBeDefined();
      });

      it('应该拒绝缺少必要参数的请求', async () => {
        const response = await request(app)
          .get('/api/votes/sweep-unit-rooms?round_id=1')
          .set('Authorization', `Bearer ${superAdminToken}`);

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('缺少必要参数: round_id, phase_id, building, unit');
      });

      it('应该处理空数据', async () => {
        pool.query.mockResolvedValueOnce([[]]);

        const response = await request(app)
          .get('/api/votes/sweep-unit-rooms?round_id=1&phase_id=1&building=99&unit=99')
          .set('Authorization', `Bearer ${superAdminToken}`);

        expect(response.status).toBe(200);
        expect(response.body.meta.total_rooms).toBe(0);
      });

      it('应该处理服务器错误', async () => {
        pool.query.mockRejectedValueOnce(new Error('Database error'));

        const response = await request(app)
          .get('/api/votes/sweep-unit-rooms?round_id=1&phase_id=1&building=01&unit=01')
          .set('Authorization', `Bearer ${superAdminToken}`);

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('服务器错误');
      });
    });

    describe('PUT /api/votes/sweep/:ownerId', () => {
      it('应该成功更新扫楼状态', async () => {
        // 第一次查询：获取业主所属小区
        pool.query.mockResolvedValueOnce([[{ room_number: '01-01-0101', community_id: 1 }]]);
        // 第二次查询：更新扫楼状态
        pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
        // 第三次查询：记录日志
        pool.query.mockResolvedValueOnce([{ insertId: 1 }]);

        const response = await request(app)
          .put('/api/votes/sweep/1')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .send({ round_id: 1, sweep_status: 'completed', sweep_remark: '已完成' });

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('更新成功');
      });

      it('应该拒绝缺少轮次ID的请求', async () => {
        const response = await request(app)
          .put('/api/votes/sweep/1')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .send({ sweep_status: 'completed' });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('请指定投票轮次');
      });

      it('应该返回 404 如果业主不存在', async () => {
        pool.query.mockResolvedValueOnce([[]]); // 业主不存在

        const response = await request(app)
          .put('/api/votes/sweep/999')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .send({ round_id: 1, sweep_status: 'completed' });

        expect(response.status).toBe(404);
        expect(response.body.error).toBe('业主不存在');
      });

      it('小区管理员无权更新其他小区的扫楼状态', async () => {
        pool.query.mockResolvedValueOnce([[{ room_number: '01-01-0101', community_id: 2 }]]); // 不同小区

        const response = await request(app)
          .put('/api/votes/sweep/1')
          .set('Authorization', `Bearer ${communityAdminToken}`)
          .send({ round_id: 1, sweep_status: 'completed' });

        expect(response.status).toBe(403);
        expect(response.body.error).toBe('无权管理该小区');
      });

      it('应该处理服务器错误', async () => {
        pool.query.mockRejectedValueOnce(new Error('Database error'));

        const response = await request(app)
          .put('/api/votes/sweep/1')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .send({ round_id: 1, sweep_status: 'completed' });

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('服务器错误');
      });
    });

    describe('PUT /api/votes/sweep-batch', () => {
      it('应该成功批量更新扫楼状态', async () => {
        // 第一次查询：批量更新
        pool.query.mockResolvedValueOnce([{ affectedRows: 3 }]);
        // 第二次查询：记录日志
        pool.query.mockResolvedValueOnce([{ insertId: 1 }]);

        const response = await request(app)
          .put('/api/votes/sweep-batch')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .send({ owner_ids: [1, 2, 3], round_id: 1, sweep_status: 'completed', community_id: 1 });

        expect(response.status).toBe(200);
        expect(response.body.message).toContain('成功更新');
      });

      it('应该拒绝空的业主列表', async () => {
        const response = await request(app)
          .put('/api/votes/sweep-batch')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .send({ owner_ids: [], round_id: 1, sweep_status: 'completed', community_id: 1 });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('请选择业主');
      });

      it('应该拒绝缺少轮次ID的请求', async () => {
        const response = await request(app)
          .put('/api/votes/sweep-batch')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .send({ owner_ids: [1, 2], sweep_status: 'completed', community_id: 1 });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('请选择投票轮次');
      });

      it('应该拒绝缺少扫楼状态的请求', async () => {
        const response = await request(app)
          .put('/api/votes/sweep-batch')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .send({ owner_ids: [1, 2], round_id: 1, community_id: 1 });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('请选择扫楼状态');
      });

      it('小区管理员无权批量更新其他小区的扫楼状态', async () => {
        const response = await request(app)
          .put('/api/votes/sweep-batch')
          .set('Authorization', `Bearer ${communityAdminToken}`)
          .send({ owner_ids: [1, 2], round_id: 1, sweep_status: 'completed', community_id: 2 }); // 不同小区

        expect(response.status).toBe(403);
        expect(response.body.error).toBe('无权管理该小区');
      });

      it('应该处理服务器错误', async () => {
        pool.query.mockRejectedValueOnce(new Error('Database error'));

        const response = await request(app)
          .put('/api/votes/sweep-batch')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .send({ owner_ids: [1, 2], round_id: 1, sweep_status: 'completed', community_id: 1 });

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('服务器错误');
      });
    });
  });

  describe('Export', () => {
    describe('GET /api/votes/export', () => {
      it('应该拒绝缺少轮次ID的请求', async () => {
        const response = await request(app)
          .get('/api/votes/export')
          .set('Authorization', `Bearer ${superAdminToken}`);

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('请指定投票轮次');
      });

      it('应该成功导出投票记录', async () => {
        const mockRecords = [
          { seq_no: 1, room_number: '01-01-0101', building: '01', unit: '01', room: '0101', owner_name: '张三', community_name: '阳光花园', phase_name: '一期', round_name: '2024', vote_status: 'voted' }
        ];
        pool.query.mockResolvedValueOnce([mockRecords]);

        const response = await request(app)
          .get('/api/votes/export?round_id=1')
          .set('Authorization', `Bearer ${superAdminToken}`);

        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toContain('spreadsheetml');
      });

      it('应该支持按状态筛选导出', async () => {
        pool.query.mockResolvedValueOnce([[{ seq_no: 1, vote_status: 'pending' }]]);

        const response = await request(app)
          .get('/api/votes/export?round_id=1&vote_status=pending')
          .set('Authorization', `Bearer ${superAdminToken}`);

        expect(response.status).toBe(200);
      });

      it('应该支持搜索导出', async () => {
        pool.query.mockResolvedValueOnce([[{ seq_no: 1, owner_name: '张三' }]]);

        const response = await request(app)
          .get('/api/votes/export?round_id=1&search=张三')
          .set('Authorization', `Bearer ${superAdminToken}`);

        expect(response.status).toBe(200);
      });

      it('普通用户只能导出本小区的数据', async () => {
        pool.query.mockResolvedValueOnce([[{ seq_no: 1, vote_status: 'voted' }]]);

        const response = await request(app)
          .get('/api/votes/export?round_id=1')
          .set('Authorization', `Bearer ${communityUserToken}`);

        expect(response.status).toBe(200);
      });

      it('应该处理服务器错误', async () => {
        pool.query.mockRejectedValueOnce(new Error('Database error'));

        const response = await request(app)
          .get('/api/votes/export?round_id=1')
          .set('Authorization', `Bearer ${superAdminToken}`);

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('服务器错误');
      });
    });
  });

  describe('Excel Import', () => {
    describe('POST /api/votes/import', () => {
      it('应该拒绝未认证的请求', async () => {
        const response = await request(app)
          .post('/api/votes/import')
          .field('round_id', '1')
          .field('community_id', '1');

        expect(response.status).toBe(401);
      });

      it('应该拒绝非管理员', async () => {
        const response = await request(app)
          .post('/api/votes/import')
          .set('Authorization', `Bearer ${communityUserToken}`)
          .field('round_id', '1')
          .field('community_id', '1');

        expect(response.status).toBe(403);
      });

      it('应该拒绝没有上传文件的请求', async () => {
        const response = await request(app)
          .post('/api/votes/import')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .field('round_id', '1')
          .field('community_id', '1');

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('请上传文件');
      });

      it('应该拒绝无效的文件类型', async () => {
        const response = await request(app)
          .post('/api/votes/import')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .field('round_id', '1')
          .field('community_id', '1')
          .attach('file', Buffer.from('invalid content'), {
            filename: 'test.txt',
            contentType: 'text/plain'
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('请上传有效的 Excel 文件 (.xlsx 或 .xls)');
      });

      it('应该拒绝缺少 round_id 或 community_id', async () => {
        const excelData = [['房间号', '投否'], ['01-01-0101', '是']];
        const excelBuffer = createExcelBuffer(excelData);

        const response = await request(app)
          .post('/api/votes/import')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .attach('file', excelBuffer, {
            filename: 'test.xlsx',
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('请选择投票轮次和小区');
      });

      it('小区管理员不能导入其他小区的数据', async () => {
        const excelData = [['房间号', '投否'], ['01-01-0101', '是']];
        const excelBuffer = createExcelBuffer(excelData);

        const response = await request(app)
          .post('/api/votes/import')
          .set('Authorization', `Bearer ${communityAdminToken}`)
          .field('round_id', '1')
          .field('community_id', '999')
          .attach('file', excelBuffer, {
            filename: 'test.xlsx',
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          });

        expect(response.status).toBe(403);
        expect(response.body.error).toBe('无权管理该小区');
      });

      it('应该拒绝空的 Excel 文件', async () => {
        const excelData = [['房间号', '投否']]; // 只有表头，没有数据
        const excelBuffer = createExcelBuffer(excelData);

        const response = await request(app)
          .post('/api/votes/import')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .field('round_id', '1')
          .field('community_id', '1')
          .attach('file', excelBuffer, {
            filename: 'test.xlsx',
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Excel 文件为空或格式错误');
      });

      it('应该拒绝没有房间号列的 Excel', async () => {
        const excelData = [['姓名', '投否'], ['张三', '是']];
        const excelBuffer = createExcelBuffer(excelData);

        const response = await request(app)
          .post('/api/votes/import')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .field('round_id', '1')
          .field('community_id', '1')
          .attach('file', excelBuffer, {
            filename: 'test.xlsx',
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('找不到房间号列');
      });

      it('应该拒绝没有投票状态列的 Excel', async () => {
        const excelData = [['房间号', '姓名'], ['01-01-0101', '张三']];
        const excelBuffer = createExcelBuffer(excelData);

        const response = await request(app)
          .post('/api/votes/import')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .field('round_id', '1')
          .field('community_id', '1')
          .attach('file', excelBuffer, {
            filename: 'test.xlsx',
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('找不到投票状态列，请指定 vote_column 参数');
      });

      it('应该成功导入投票记录', async () => {
        const excelData = [
          ['房间号', '投否', '备注', '扫楼'],
          ['01-01-0101', '是', '已完成', '是'],
          ['01-01-0102', '1', '', ''],
          ['01-01-0103', '否', '', ''],
        ];
        const excelBuffer = createExcelBuffer(excelData);

        // Mock owners query
        pool.query.mockResolvedValueOnce([[
          { id: 1, room_number: '01-01-0101' },
          { id: 2, room_number: '01-01-0102' },
          { id: 3, room_number: '01-01-0103' },
        ]]);
        // Mock bulk insert
        pool.query.mockResolvedValueOnce([{ affectedRows: 3 }]);
        // Mock log insert
        pool.query.mockResolvedValueOnce([{ insertId: 1 }]);

        const response = await request(app)
          .post('/api/votes/import')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .field('round_id', '1')
          .field('community_id', '1')
          .attach('file', excelBuffer, {
            filename: 'test.xlsx',
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(3);
        expect(response.body.voted).toBe(2);
        expect(response.body.pending).toBe(1);
        expect(response.body.notFound).toBe(0);
      });

      it('应该处理找不到的房间', async () => {
        const excelData = [
          ['房间号', '投否'],
          ['01-01-0101', '是'],
          ['99-99-9999', '是'], // 不存在的房间
        ];
        const excelBuffer = createExcelBuffer(excelData);

        // Mock owners query - 只有一个房间匹配
        pool.query.mockResolvedValueOnce([[
          { id: 1, room_number: '01-01-0101' },
        ]]);
        // Mock bulk insert
        pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
        // Mock log insert
        pool.query.mockResolvedValueOnce([{ insertId: 1 }]);

        const response = await request(app)
          .post('/api/votes/import')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .field('round_id', '1')
          .field('community_id', '1')
          .attach('file', excelBuffer, {
            filename: 'test.xlsx',
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(1);
        expect(response.body.notFound).toBe(1);
        expect(response.body.notFoundRooms).toContain('99-99-9999');
      });

      it('应该支持自定义 vote_column 参数', async () => {
        const excelData = [
          ['房间号', '自定义投票列'],
          ['01-01-0101', '是'],
        ];
        const excelBuffer = createExcelBuffer(excelData);

        pool.query.mockResolvedValueOnce([[{ id: 1, room_number: '01-01-0101' }]]);
        pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
        pool.query.mockResolvedValueOnce([{ insertId: 1 }]);

        const response = await request(app)
          .post('/api/votes/import')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .field('round_id', '1')
          .field('community_id', '1')
          .field('vote_column', '自定义投票列')
          .attach('file', excelBuffer, {
            filename: 'test.xlsx',
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          });

        expect(response.status).toBe(200);
        expect(response.body.voteColumn).toBe('自定义投票列');
      });

      it('应该处理大批量数据导入', async () => {
        // 创建超过1000条记录的数据
        const excelData = [['房间号', '投否']];
        const mockOwners = [];
        for (let i = 1; i <= 1500; i++) {
          const room = `01-01-${String(i).padStart(4, '0')}`;
          excelData.push([room, '是']);
          mockOwners.push({ id: i, room_number: room });
        }
        const excelBuffer = createExcelBuffer(excelData);

        pool.query.mockResolvedValueOnce([mockOwners]);
        // 两次批量插入（1000 + 500）
        pool.query.mockResolvedValueOnce([{ affectedRows: 1000 }]);
        pool.query.mockResolvedValueOnce([{ affectedRows: 500 }]);
        pool.query.mockResolvedValueOnce([{ insertId: 1 }]);

        const response = await request(app)
          .post('/api/votes/import')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .field('round_id', '1')
          .field('community_id', '1')
          .attach('file', excelBuffer, {
            filename: 'test.xlsx',
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(1500);
      });

      it('小区管理员可以导入本小区的数据', async () => {
        const excelData = [
          ['房间号', '投否'],
          ['01-01-0101', '是'],
        ];
        const excelBuffer = createExcelBuffer(excelData);

        pool.query.mockResolvedValueOnce([[{ id: 1, room_number: '01-01-0101' }]]);
        pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
        pool.query.mockResolvedValueOnce([{ insertId: 1 }]);

        const response = await request(app)
          .post('/api/votes/import')
          .set('Authorization', `Bearer ${communityAdminToken}`)
          .field('round_id', '1')
          .field('community_id', '1')
          .attach('file', excelBuffer, {
            filename: 'test.xlsx',
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          });

        expect(response.status).toBe(200);
      });

      it('应该处理房间号格式标准化', async () => {
        const excelData = [
          ['房间号', '投否'],
          ['01 01 0101', '是'], // 带空格
          ['02-01-0201', '是'], // 带横线
        ];
        const excelBuffer = createExcelBuffer(excelData);

        pool.query.mockResolvedValueOnce([[
          { id: 1, room_number: '01-01-0101' },
          { id: 2, room_number: '02-01-0201' },
        ]]);
        pool.query.mockResolvedValueOnce([{ affectedRows: 2 }]);
        pool.query.mockResolvedValueOnce([{ insertId: 1 }]);

        const response = await request(app)
          .post('/api/votes/import')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .field('round_id', '1')
          .field('community_id', '1')
          .attach('file', excelBuffer, {
            filename: 'test.xlsx',
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          });

        expect(response.status).toBe(200);
      });

      it('应该处理服务器错误', async () => {
        const excelData = [
          ['房间号', '投否'],
          ['01-01-0101', '是'],
        ];
        const excelBuffer = createExcelBuffer(excelData);

        pool.query.mockRejectedValueOnce(new Error('Database error'));

        const response = await request(app)
          .post('/api/votes/import')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .field('round_id', '1')
          .field('community_id', '1')
          .attach('file', excelBuffer, {
            filename: 'test.xlsx',
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          });

        expect(response.status).toBe(500);
        expect(response.body.error).toContain('服务器错误');
      });

      it('应该支持 xls 文件扩展名', async () => {
        const excelData = [
          ['房间号', '投否'],
          ['01-01-0101', '是'],
        ];
        const excelBuffer = createExcelBuffer(excelData);

        pool.query.mockResolvedValueOnce([[{ id: 1, room_number: '01-01-0101' }]]);
        pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
        pool.query.mockResolvedValueOnce([{ insertId: 1 }]);

        const response = await request(app)
          .post('/api/votes/import')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .field('round_id', '1')
          .field('community_id', '1')
          .attach('file', excelBuffer, {
            filename: 'test.xls',
            contentType: 'application/vnd.ms-excel'
          });

        expect(response.status).toBe(200);
      });

      it('应该跳过空行', async () => {
        const excelData = [
          ['房间号', '投否'],
          ['01-01-0101', '是'],
          ['', ''], // 空行
          [null, null], // 空行
          ['01-01-0102', '否'],
        ];
        const excelBuffer = createExcelBuffer(excelData);

        pool.query.mockResolvedValueOnce([[
          { id: 1, room_number: '01-01-0101' },
          { id: 2, room_number: '01-01-0102' },
        ]]);
        pool.query.mockResolvedValueOnce([{ affectedRows: 2 }]);
        pool.query.mockResolvedValueOnce([{ insertId: 1 }]);

        const response = await request(app)
          .post('/api/votes/import')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .field('round_id', '1')
          .field('community_id', '1')
          .attach('file', excelBuffer, {
            filename: 'test.xlsx',
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(2);
      });

      it('应该限制返回的未找到房间数量', async () => {
        const excelData = [['房间号', '投否']];
        // 添加 15 个不存在的房间
        for (let i = 1; i <= 15; i++) {
          excelData.push([`99-99-${String(i).padStart(4, '0')}`, '是']);
        }
        const excelBuffer = createExcelBuffer(excelData);

        // 没有匹配的业主
        pool.query.mockResolvedValueOnce([[]]);
        pool.query.mockResolvedValueOnce([{ insertId: 1 }]);

        const response = await request(app)
          .post('/api/votes/import')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .field('round_id', '1')
          .field('community_id', '1')
          .attach('file', excelBuffer, {
            filename: 'test.xlsx',
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          });

        expect(response.status).toBe(200);
        expect(response.body.notFound).toBe(15);
        expect(response.body.notFoundRooms.length).toBeLessThanOrEqual(10);
      });
    });
  });
});
