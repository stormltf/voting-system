const request = require('supertest');
const ExcelJS = require('exceljs');

// Mock 数据库模块
jest.mock('../../src/models/db', () => require('../mocks/db'));

const { pool } = require('../../src/models/db');
const { generateToken, ROLES } = require('../../src/middleware/auth');
const { app } = require('../../src/index');

// Helper function to create Excel buffer for testing
async function createOwnerExcelBuffer(data, sheetName = 'Sheet1') {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName);

  if (!Array.isArray(data) || data.length === 0) {
    ws.addRow(['占位']);
  } else {
    const headers = Object.keys(data[0]);
    ws.addRow(headers);
    for (const item of data) {
      ws.addRow(headers.map(h => item[h]));
    }
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}

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

    it('应该支持按期数筛选', async () => {
      pool.query.mockResolvedValueOnce([[{ total: 1 }]]);
      pool.query.mockResolvedValueOnce([[{ id: 1, phase_id: 1 }]]);

      const response = await request(app)
        .get('/api/owners?phase_id=1')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(200);
    });

    it('应该支持按楼栋筛选', async () => {
      pool.query.mockResolvedValueOnce([[{ total: 1 }]]);
      pool.query.mockResolvedValueOnce([[{ id: 1, building: '01' }]]);

      const response = await request(app)
        .get('/api/owners?building=01')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(200);
    });

    it('应该支持按小区筛选（超级管理员）', async () => {
      pool.query.mockResolvedValueOnce([[{ total: 1 }]]);
      pool.query.mockResolvedValueOnce([[{ id: 1, community_id: 1 }]]);

      const response = await request(app)
        .get('/api/owners?community_id=1')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(200);
    });

    it('应该支持按微信状态筛选', async () => {
      pool.query.mockResolvedValueOnce([[{ total: 1 }]]);
      pool.query.mockResolvedValueOnce([[{ id: 1, wechat_status: '已入群' }]]);

      const response = await request(app)
        .get('/api/owners?wechat_status=已入群')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(200);
    });

    it('应该支持按房屋状态筛选', async () => {
      pool.query.mockResolvedValueOnce([[{ total: 1 }]]);
      pool.query.mockResolvedValueOnce([[{ id: 1, house_status: '自住' }]]);

      const response = await request(app)
        .get('/api/owners?house_status=自住')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(200);
    });

    it('应该支持按投票状态筛选', async () => {
      pool.query.mockResolvedValueOnce([[{ total: 1 }]]);
      pool.query.mockResolvedValueOnce([[{ id: 1, vote_status: 'voted' }]]);

      const response = await request(app)
        .get('/api/owners?round_id=1&vote_status=voted')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(200);
    });

    it('应该支持筛选待投票状态', async () => {
      pool.query.mockResolvedValueOnce([[{ total: 1 }]]);
      pool.query.mockResolvedValueOnce([[{ id: 1, vote_status: 'pending' }]]);

      const response = await request(app)
        .get('/api/owners?round_id=1&vote_status=pending')
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

    it('应该处理服务器错误', async () => {
      pool.query.mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .get('/api/owners')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('服务器内部错误，请稍后重试');
    });
  });

  describe('GET /api/owners/export', () => {
    it('应该成功导出业主数据', async () => {
      const mockOwners = [
        { seq_no: 1, community_name: '阳光花园', phase_name: '一期', room_number: '01-01-0101', building: '01', unit: '01', room: '0101', owner_name: '张三' }
      ];
      pool.query.mockResolvedValueOnce([mockOwners]);

      const response = await request(app)
        .get('/api/owners/export')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('spreadsheetml');
    });

    it('应该支持按期数筛选导出', async () => {
      pool.query.mockResolvedValueOnce([[{ seq_no: 1, phase_name: '一期' }]]);

      const response = await request(app)
        .get('/api/owners/export?phase_id=1')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(200);
    });

    it('应该支持按小区筛选导出', async () => {
      pool.query.mockResolvedValueOnce([[{ seq_no: 1, community_id: 1 }]]);

      const response = await request(app)
        .get('/api/owners/export?community_id=1')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(200);
    });

    it('应该支持按楼栋筛选导出', async () => {
      pool.query.mockResolvedValueOnce([[{ seq_no: 1, building: '01' }]]);

      const response = await request(app)
        .get('/api/owners/export?building=01')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(200);
    });

    it('应该支持搜索导出', async () => {
      pool.query.mockResolvedValueOnce([[{ seq_no: 1, owner_name: '张三' }]]);

      const response = await request(app)
        .get('/api/owners/export?search=张三')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(200);
    });

    it('应该支持带投票信息导出', async () => {
      pool.query.mockResolvedValueOnce([[{ seq_no: 1, vote_status: 'voted', vote_date: '2024-01-01' }]]);

      const response = await request(app)
        .get('/api/owners/export?round_id=1')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(200);
    });

    it('应该支持按投票状态筛选导出', async () => {
      pool.query.mockResolvedValueOnce([[{ seq_no: 1, vote_status: 'pending' }]]);

      const response = await request(app)
        .get('/api/owners/export?round_id=1&vote_status=pending')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(200);
    });

    it('普通用户只能导出本小区的数据', async () => {
      pool.query.mockResolvedValueOnce([[{ seq_no: 1, community_id: 1 }]]);

      const response = await request(app)
        .get('/api/owners/export')
        .set('Authorization', `Bearer ${communityUserToken}`);

      expect(response.status).toBe(200);
    });

    it('应该处理服务器错误', async () => {
      pool.query.mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .get('/api/owners/export')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('服务器内部错误，请稍后重试');
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

    it('应该返回业主的投票记录', async () => {
      const mockOwner = { id: 1, room_number: '01-01-0101', community_id: 1 };
      const mockVotes = [{ round_id: 1, round_name: '2024业主大会', vote_status: 'voted' }];
      pool.query.mockResolvedValueOnce([[mockOwner]]);
      pool.query.mockResolvedValueOnce([mockVotes]);

      const response = await request(app)
        .get('/api/owners/1')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.votes).toHaveLength(1);
    });

    it('应该处理服务器错误', async () => {
      pool.query.mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .get('/api/owners/1')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('服务器内部错误，请稍后重试');
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

    it('应该拒绝不存在的期数', async () => {
      pool.query.mockResolvedValueOnce([[]]); // 期数不存在

      const response = await request(app)
        .post('/api/owners')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ phase_id: 999, room_number: '01-01-0101' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('指定的期数不存在');
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

    it('应该处理服务器错误', async () => {
      pool.query.mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .post('/api/owners')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ phase_id: 1, room_number: '01-01-0101' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('服务器内部错误，请稍后重试');
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

    it('小区管理员无权更新其他小区的业主', async () => {
      pool.query.mockResolvedValueOnce([[{ community_id: 2 }]]); // 不同小区

      const response = await request(app)
        .put('/api/owners/1')
        .set('Authorization', `Bearer ${communityAdminToken}`)
        .send({ owner_name: '测试' });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('无权管理该小区数据');
    });

    it('应该支持更新所有允许的字段', async () => {
      pool.query.mockResolvedValueOnce([[{ community_id: 1 }]]);
      pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
      pool.query.mockResolvedValueOnce([[{ room_number: '01-01-0101', owner_name: '张三' }]]);
      pool.query.mockResolvedValueOnce([{ insertId: 1 }]);

      const response = await request(app)
        .put('/api/owners/1')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          seq_no: 1,
          building: '01',
          unit: '01',
          room: '0101',
          room_number: '01-01-0101',
          owner_name: '张三',
          area: 100.5,
          parking_no: 'P001',
          parking_area: 15.5,
          phone1: '13800138001',
          phone2: '13800138002',
          phone3: '13800138003',
          wechat_status: '已入群',
          wechat_contact: '微信号',
          house_status: '自住'
        });

      expect(response.status).toBe(200);
    });

    it('应该拒绝重复的房间号', async () => {
      pool.query.mockResolvedValueOnce([[{ community_id: 1 }]]);
      const error = new Error('Duplicate entry');
      error.code = 'ER_DUP_ENTRY';
      pool.query.mockRejectedValueOnce(error);

      const response = await request(app)
        .put('/api/owners/1')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ room_number: '01-01-0102' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('该房间号已存在');
    });

    it('应该处理服务器错误', async () => {
      pool.query.mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .put('/api/owners/1')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ owner_name: '测试' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('服务器内部错误，请稍后重试');
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

    it('小区管理员无权删除其他小区的业主', async () => {
      pool.query.mockResolvedValueOnce([[{ community_id: 2 }]]); // 不同小区

      const response = await request(app)
        .delete('/api/owners/1')
        .set('Authorization', `Bearer ${communityAdminToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('无权管理该小区数据');
    });

    it('应该处理服务器错误', async () => {
      pool.query.mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .delete('/api/owners/1')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('服务器内部错误，请稍后重试');
    });
  });

  describe('POST /api/owners/import', () => {
    it('应该拒绝没有文件的请求', async () => {
      const response = await request(app)
        .post('/api/owners/import')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ phase_id: 1 });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('请上传文件');
    });

    it('应该拒绝缺少期数的请求', async () => {
      const response = await request(app)
        .post('/api/owners/import')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .attach('file', Buffer.from('test'), 'test.xlsx');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('请指定期数');
    });

    it('应该拒绝不存在的期数', async () => {
      pool.query.mockResolvedValueOnce([[]]); // 期数不存在

      const response = await request(app)
        .post('/api/owners/import')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .field('phase_id', '999')
        .attach('file', Buffer.from('test'), 'test.xlsx');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('指定的期数不存在');
    });

    it('小区管理员无权导入其他小区的业主', async () => {
      pool.query.mockResolvedValueOnce([[{ community_id: 2 }]]); // 不同小区

      const response = await request(app)
        .post('/api/owners/import')
        .set('Authorization', `Bearer ${communityAdminToken}`)
        .field('phase_id', '1')
        .attach('file', Buffer.from('test'), 'test.xlsx');

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('无权管理该小区数据');
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

    it('小区管理员无权访问其他小区的楼栋列表', async () => {
      pool.query.mockResolvedValueOnce([[{ community_id: 2 }]]); // 不同小区

      const response = await request(app)
        .get('/api/owners/buildings/1')
        .set('Authorization', `Bearer ${communityAdminToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('无权访问该小区数据');
    });

    it('应该处理服务器错误', async () => {
      pool.query.mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .get('/api/owners/buildings/1')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('服务器内部错误，请稍后重试');
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

    it('应该返回 404 如果期数不存在', async () => {
      pool.query.mockResolvedValueOnce([[]]);

      const response = await request(app)
        .get('/api/owners/units/999/01')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('期数不存在');
    });

    it('小区管理员无权访问其他小区的单元列表', async () => {
      pool.query.mockResolvedValueOnce([[{ community_id: 2 }]]); // 不同小区

      const response = await request(app)
        .get('/api/owners/units/1/01')
        .set('Authorization', `Bearer ${communityAdminToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('无权访问该小区数据');
    });

    it('应该处理服务器错误', async () => {
      pool.query.mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .get('/api/owners/units/1/01')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('服务器内部错误，请稍后重试');
    });
  });

  describe('Excel Import', () => {
    describe('POST /api/owners/import', () => {
      it('应该拒绝未认证的请求', async () => {
        const response = await request(app)
          .post('/api/owners/import')
          .field('phase_id', '1');

        expect(response.status).toBe(401);
      });

      it('应该拒绝非管理员', async () => {
        const response = await request(app)
          .post('/api/owners/import')
          .set('Authorization', `Bearer ${communityUserToken}`)
          .field('phase_id', '1');

        expect(response.status).toBe(403);
      });

      it('应该拒绝没有上传文件的请求', async () => {
        const response = await request(app)
          .post('/api/owners/import')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .field('phase_id', '1');

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('请上传文件');
      });

      it('应该拒绝缺少 phase_id', async () => {
        const data = [{ '序号': 1, '房间号': '01-01-0101', '姓名': '张三' }];
        const excelBuffer = await createOwnerExcelBuffer(data);

        const response = await request(app)
          .post('/api/owners/import')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .attach('file', excelBuffer, {
            filename: 'test.xlsx',
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('请指定期数');
      });

      it('应该拒绝无效的文件类型', async () => {
        const response = await request(app)
          .post('/api/owners/import')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .field('phase_id', '1')
          .attach('file', Buffer.from('invalid content'), {
            filename: 'test.txt',
            contentType: 'text/plain'
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('请上传有效的 Excel 文件 (.xlsx)');
      });

      it('应该拒绝不存在的期数', async () => {
        const data = [{ '序号': 1, '房间号': '01-01-0101', '姓名': '张三' }];
        const excelBuffer = await createOwnerExcelBuffer(data);

        pool.query.mockResolvedValueOnce([[]]); // 期数不存在

        const response = await request(app)
          .post('/api/owners/import')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .field('phase_id', '999')
          .attach('file', excelBuffer, {
            filename: 'test.xlsx',
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('指定的期数不存在');
      });

      it('小区管理员不能导入其他小区的数据', async () => {
        const data = [{ '序号': 1, '房间号': '01-01-0101', '姓名': '张三' }];
        const excelBuffer = await createOwnerExcelBuffer(data);

        pool.query.mockResolvedValueOnce([[{ id: 1, community_id: 999 }]]); // 其他小区

        const response = await request(app)
          .post('/api/owners/import')
          .set('Authorization', `Bearer ${communityAdminToken}`)
          .field('phase_id', '1')
          .attach('file', excelBuffer, {
            filename: 'test.xlsx',
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          });

        expect(response.status).toBe(403);
        expect(response.body.error).toBe('无权管理该小区数据');
      });

      it('应该拒绝空的 Excel 文件', async () => {
        const data = [];
        const excelBuffer = await createOwnerExcelBuffer(data);

        pool.query.mockResolvedValueOnce([[{ id: 1, community_id: 1 }]]);

        const response = await request(app)
          .post('/api/owners/import')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .field('phase_id', '1')
          .attach('file', excelBuffer, {
            filename: 'test.xlsx',
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('文件中没有数据');
      });

      it('应该成功导入业主数据', async () => {
        const data = [
          {
            '序号': 1,
            '房间号': '01-01-0101',
            '姓名': '张三',
            '面积': 100.5,
            '车位号': 'A001',
            '车位面积': 15,
            '联系电话1': '13800138001',
            '联系电话2': '13800138002',
            '联系电话3': '',
            '群状态': '已入群',
            '微信沟通人': '物业管家',
            '房屋状态': '自住'
          },
          {
            '序号': 2,
            '房间号': '01-01-0102',
            '姓名': '李四',
            '面积': 88,
            '车位号': '',
            '车位面积': '',
            '联系电话1': '13800138003',
            '群状态': '',
            '房屋状态': '出租'
          }
        ];
        const excelBuffer = await createOwnerExcelBuffer(data);

        pool.query.mockResolvedValueOnce([[{ id: 1, community_id: 1 }]]); // 期数存在
        pool.query.mockResolvedValueOnce([{ affectedRows: 2 }]); // 批量插入
        pool.query.mockResolvedValueOnce([{ insertId: 1 }]); // 日志

        const response = await request(app)
          .post('/api/owners/import')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .field('phase_id', '1')
          .attach('file', excelBuffer, {
            filename: 'test.xlsx',
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          });

        expect(response.status).toBe(200);
        expect(response.body.successCount).toBe(2);
        expect(response.body.failCount).toBe(0);
      });

      it('应该处理缺少房间号的行', async () => {
        const data = [
          { '序号': 1, '房间号': '01-01-0101', '姓名': '张三' },
          { '序号': 2, '姓名': '李四' }, // 缺少房间号
          { '序号': 3, '房间号': '', '姓名': '王五' }, // 房间号为空
        ];
        const excelBuffer = await createOwnerExcelBuffer(data);

        pool.query.mockResolvedValueOnce([[{ id: 1, community_id: 1 }]]);
        pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
        pool.query.mockResolvedValueOnce([{ insertId: 1 }]);

        const response = await request(app)
          .post('/api/owners/import')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .field('phase_id', '1')
          .attach('file', excelBuffer, {
            filename: 'test.xlsx',
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          });

        expect(response.status).toBe(200);
        expect(response.body.successCount).toBe(1);
        expect(response.body.failCount).toBe(2);
        expect(response.body.errors.length).toBeGreaterThan(0);
      });

      it('应该正确解析不同格式的房间号', async () => {
        const data = [
          { '序号': 1, '房间号': '01-02-0301', '姓名': '张三' }, // 标准格式
          { '序号': 2, '房间号': '0102', '姓名': '李四' }, // 简单格式
          { '序号': 3, '房间号': '01-02-03-04', '姓名': '王五' }, // 多段格式
        ];
        const excelBuffer = await createOwnerExcelBuffer(data);

        pool.query.mockResolvedValueOnce([[{ id: 1, community_id: 1 }]]);
        pool.query.mockResolvedValueOnce([{ affectedRows: 3 }]);
        pool.query.mockResolvedValueOnce([{ insertId: 1 }]);

        const response = await request(app)
          .post('/api/owners/import')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .field('phase_id', '1')
          .attach('file', excelBuffer, {
            filename: 'test.xlsx',
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          });

        expect(response.status).toBe(200);
        expect(response.body.successCount).toBe(3);
      });

      it('应该处理面积带加号的情况', async () => {
        const data = [
          { '序号': 1, '房间号': '01-01-0101', '姓名': '张三', '面积': '100.5+' },
        ];
        const excelBuffer = await createOwnerExcelBuffer(data);

        pool.query.mockResolvedValueOnce([[{ id: 1, community_id: 1 }]]);
        pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
        pool.query.mockResolvedValueOnce([{ insertId: 1 }]);

        const response = await request(app)
          .post('/api/owners/import')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .field('phase_id', '1')
          .attach('file', excelBuffer, {
            filename: 'test.xlsx',
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          });

        expect(response.status).toBe(200);
        expect(response.body.successCount).toBe(1);
      });

      it('应该处理大批量数据导入', async () => {
        const data = [];
        for (let i = 1; i <= 1500; i++) {
          data.push({
            '序号': i,
            '房间号': `01-01-${String(i).padStart(4, '0')}`,
            '姓名': `业主${i}`
          });
        }
        const excelBuffer = await createOwnerExcelBuffer(data);

        pool.query.mockResolvedValueOnce([[{ id: 1, community_id: 1 }]]);
        pool.query.mockResolvedValueOnce([{ affectedRows: 1000 }]); // 第一批
        pool.query.mockResolvedValueOnce([{ affectedRows: 500 }]); // 第二批
        pool.query.mockResolvedValueOnce([{ insertId: 1 }]);

        const response = await request(app)
          .post('/api/owners/import')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .field('phase_id', '1')
          .attach('file', excelBuffer, {
            filename: 'test.xlsx',
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          });

        expect(response.status).toBe(200);
        expect(response.body.successCount).toBe(1500);
      });

      it('小区管理员可以导入本小区的数据', async () => {
        const data = [
          { '序号': 1, '房间号': '01-01-0101', '姓名': '张三' }
        ];
        const excelBuffer = await createOwnerExcelBuffer(data);

        pool.query.mockResolvedValueOnce([[{ id: 1, community_id: 1 }]]); // 本小区
        pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
        pool.query.mockResolvedValueOnce([{ insertId: 1 }]);

        const response = await request(app)
          .post('/api/owners/import')
          .set('Authorization', `Bearer ${communityAdminToken}`)
          .field('phase_id', '1')
          .attach('file', excelBuffer, {
            filename: 'test.xlsx',
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          });

        expect(response.status).toBe(200);
        expect(response.body.successCount).toBe(1);
      });

      it('应该拒绝 xls 文件扩展名', async () => {
        const data = [
          { '序号': 1, '房间号': '01-01-0101', '姓名': '张三' }
        ];
        const excelBuffer = await createOwnerExcelBuffer(data);

        const response = await request(app)
          .post('/api/owners/import')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .field('phase_id', '1')
          .attach('file', excelBuffer, {
            filename: 'test.xls',
            contentType: 'application/vnd.ms-excel'
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('请上传有效的 Excel 文件 (.xlsx)');
      });

      it('应该限制返回的错误数量', async () => {
        const data = [];
        // 添加 15 个缺少房间号的行
        for (let i = 1; i <= 15; i++) {
          data.push({ '序号': i, '姓名': `业主${i}` });
        }
        const excelBuffer = await createOwnerExcelBuffer(data);

        pool.query.mockResolvedValueOnce([[{ id: 1, community_id: 1 }]]);
        pool.query.mockResolvedValueOnce([{ insertId: 1 }]);

        const response = await request(app)
          .post('/api/owners/import')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .field('phase_id', '1')
          .attach('file', excelBuffer, {
            filename: 'test.xlsx',
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          });

        expect(response.status).toBe(200);
        expect(response.body.failCount).toBe(15);
        expect(response.body.errors.length).toBeLessThanOrEqual(10);
      });

      it('应该处理服务器错误', async () => {
        const data = [
          { '序号': 1, '房间号': '01-01-0101', '姓名': '张三' }
        ];
        const excelBuffer = await createOwnerExcelBuffer(data);

        pool.query.mockRejectedValueOnce(new Error('Database error'));

        const response = await request(app)
          .post('/api/owners/import')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .field('phase_id', '1')
          .attach('file', excelBuffer, {
            filename: 'test.xlsx',
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          });

        expect(response.status).toBe(500);
        expect(response.body.error).toContain('服务器错误');
      });

      it('应该处理所有列映射', async () => {
        const data = [
          {
            '序号': 1,
            '房间号': '01-01-0101',
            '姓名': '张三',
            '面积': 100,
            '车位号': 'A001',
            '车位面积': 15,
            '联系电话1': '13800138001',
            '联系电话2': '13800138002',
            '联系电话3': '13800138003',
            '群状态': '已入群',
            '微信沟通人': '小王',
            '房屋状态': '自住'
          }
        ];
        const excelBuffer = await createOwnerExcelBuffer(data);

        pool.query.mockResolvedValueOnce([[{ id: 1, community_id: 1 }]]);
        pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
        pool.query.mockResolvedValueOnce([{ insertId: 1 }]);

        const response = await request(app)
          .post('/api/owners/import')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .field('phase_id', '1')
          .attach('file', excelBuffer, {
            filename: 'test.xlsx',
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          });

        expect(response.status).toBe(200);
        expect(response.body.successCount).toBe(1);
      });
    });
  });
});
