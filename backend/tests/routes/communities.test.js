const request = require('supertest');

// Mock 数据库模块
jest.mock('../../src/models/db', () => require('../mocks/db'));

const { pool } = require('../../src/models/db');
const { generateToken, ROLES } = require('../../src/middleware/auth');
const { app } = require('../../src/index');

describe('Communities Routes', () => {
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

  describe('GET /api/communities', () => {
    it('应该拒绝未认证的请求', async () => {
      const response = await request(app).get('/api/communities');
      expect(response.status).toBe(401);
    });

    it('超级管理员应该返回所有小区列表', async () => {
      const mockCommunities = [
        { id: 1, name: '阳光花园', address: '某市某区', phase_count: 2, owner_count: 100 },
        { id: 2, name: '绿地小区', address: '某市某路', phase_count: 1, owner_count: 50 },
      ];
      pool.query.mockResolvedValueOnce([mockCommunities]);

      const response = await request(app)
        .get('/api/communities')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body[0].name).toBe('阳光花园');
    });

    it('小区管理员只能看到自己的小区', async () => {
      const mockCommunities = [
        { id: 1, name: '阳光花园', address: '某市某区', phase_count: 2, owner_count: 100 },
      ];
      pool.query.mockResolvedValueOnce([mockCommunities]);

      const response = await request(app)
        .get('/api/communities')
        .set('Authorization', `Bearer ${communityAdminToken}`);

      expect(response.status).toBe(200);
    });

    it('普通用户只能看到自己的小区', async () => {
      const mockCommunities = [
        { id: 1, name: '阳光花园', address: '某市某区', phase_count: 2, owner_count: 100 },
      ];
      pool.query.mockResolvedValueOnce([mockCommunities]);

      const response = await request(app)
        .get('/api/communities')
        .set('Authorization', `Bearer ${communityUserToken}`);

      expect(response.status).toBe(200);
    });

    it('应该处理服务器错误', async () => {
      pool.query.mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .get('/api/communities')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('服务器内部错误，请稍后重试');
    });
  });

  describe('GET /api/communities/:id', () => {
    it('应该返回单个小区详情', async () => {
      const mockCommunity = { id: 1, name: '阳光花园', address: '某市某区' };
      const mockPhases = [
        { id: 1, name: '一期', code: 'P1', owner_count: 50, total_area: 5000 },
      ];
      pool.query
        .mockResolvedValueOnce([[mockCommunity]])
        .mockResolvedValueOnce([mockPhases]);

      const response = await request(app)
        .get('/api/communities/1')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('阳光花园');
      expect(response.body.phases).toHaveLength(1);
    });

    it('应该返回 404 如果小区不存在', async () => {
      pool.query.mockResolvedValueOnce([[]]);

      const response = await request(app)
        .get('/api/communities/999')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('小区不存在');
    });

    it('小区管理员无权访问其他小区', async () => {
      const response = await request(app)
        .get('/api/communities/2')
        .set('Authorization', `Bearer ${communityAdminToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('无权访问该小区');
    });

    it('普通用户无权访问其他小区', async () => {
      const response = await request(app)
        .get('/api/communities/2')
        .set('Authorization', `Bearer ${communityUserToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('无权访问该小区');
    });

    it('应该处理服务器错误', async () => {
      pool.query.mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .get('/api/communities/1')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('服务器内部错误，请稍后重试');
    });
  });

  describe('POST /api/communities', () => {
    it('应该拒绝普通用户创建小区', async () => {
      const response = await request(app)
        .post('/api/communities')
        .set('Authorization', `Bearer ${communityUserToken}`)
        .send({ name: '新小区', address: '地址' });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('需要超级管理员权限');
    });

    it('应该拒绝小区管理员创建小区', async () => {
      const response = await request(app)
        .post('/api/communities')
        .set('Authorization', `Bearer ${communityAdminToken}`)
        .send({ name: '新小区', address: '地址' });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('需要超级管理员权限');
    });

    it('应该拒绝空的小区名称', async () => {
      const response = await request(app)
        .post('/api/communities')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ name: '', address: '某地址' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('小区名称不能为空');
    });

    it('应该成功创建小区', async () => {
      pool.query
        .mockResolvedValueOnce([{ insertId: 1 }])
        .mockResolvedValueOnce([{ insertId: 1 }]); // 记录日志

      const response = await request(app)
        .post('/api/communities')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ name: '新建小区', address: '新地址', description: '描述' });

      expect(response.status).toBe(201);
      expect(response.body.id).toBe(1);
      expect(response.body.name).toBe('新建小区');
    });

    it('应该处理服务器错误', async () => {
      pool.query.mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .post('/api/communities')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ name: '新小区', address: '地址' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('服务器内部错误，请稍后重试');
    });
  });

  describe('PUT /api/communities/:id', () => {
    it('应该拒绝普通用户更新小区', async () => {
      const response = await request(app)
        .put('/api/communities/1')
        .set('Authorization', `Bearer ${communityUserToken}`)
        .send({ name: '更新' });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('需要管理员权限');
    });

    it('小区管理员无权更新其他小区', async () => {
      const response = await request(app)
        .put('/api/communities/2')
        .set('Authorization', `Bearer ${communityAdminToken}`)
        .send({ name: '更新' });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('无权管理该小区');
    });

    it('小区管理员可以更新自己的小区', async () => {
      pool.query
        .mockResolvedValueOnce([{ affectedRows: 1 }])
        .mockResolvedValueOnce([{ insertId: 1 }]); // 记录日志

      const response = await request(app)
        .put('/api/communities/1')
        .set('Authorization', `Bearer ${communityAdminToken}`)
        .send({ name: '更新后的名称', address: '更新后的地址' });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('更新后的名称');
    });

    it('超级管理员应该成功更新小区', async () => {
      pool.query
        .mockResolvedValueOnce([{ affectedRows: 1 }])
        .mockResolvedValueOnce([{ insertId: 1 }]); // 记录日志

      const response = await request(app)
        .put('/api/communities/1')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ name: '更新后的名称', address: '更新后的地址' });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('更新后的名称');
    });

    it('应该返回 404 如果小区不存在', async () => {
      pool.query.mockResolvedValueOnce([{ affectedRows: 0 }]);

      const response = await request(app)
        .put('/api/communities/999')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ name: '测试' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('小区不存在');
    });

    it('应该处理服务器错误', async () => {
      pool.query.mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .put('/api/communities/1')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ name: '测试' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('服务器内部错误，请稍后重试');
    });
  });

  describe('DELETE /api/communities/:id', () => {
    it('应该拒绝普通用户删除小区', async () => {
      const response = await request(app)
        .delete('/api/communities/1')
        .set('Authorization', `Bearer ${communityUserToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('需要超级管理员权限');
    });

    it('应该拒绝小区管理员删除小区', async () => {
      const response = await request(app)
        .delete('/api/communities/1')
        .set('Authorization', `Bearer ${communityAdminToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('需要超级管理员权限');
    });

    it('应该成功删除小区', async () => {
      pool.query
        .mockResolvedValueOnce([[{ id: 1, name: '测试小区' }]])
        .mockResolvedValueOnce([{ affectedRows: 1 }])
        .mockResolvedValueOnce([{ insertId: 1 }]); // 记录日志

      const response = await request(app)
        .delete('/api/communities/1')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('删除成功');
    });

    it('应该返回 404 如果小区不存在', async () => {
      pool.query.mockResolvedValueOnce([[]]);

      const response = await request(app)
        .delete('/api/communities/999')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('小区不存在');
    });

    it('应该处理服务器错误', async () => {
      pool.query.mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .delete('/api/communities/1')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('服务器内部错误，请稍后重试');
    });
  });

  describe('Phases Management', () => {
    describe('GET /api/communities/:communityId/phases', () => {
      it('应该返回期数列表', async () => {
        const mockPhases = [
          { id: 1, name: '一期', code: 'P1', owner_count: 50 },
          { id: 2, name: '二期', code: 'P2', owner_count: 30 },
        ];
        pool.query.mockResolvedValueOnce([mockPhases]);

        const response = await request(app)
          .get('/api/communities/1/phases')
          .set('Authorization', `Bearer ${superAdminToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(2);
      });

      it('小区管理员无权访问其他小区的期数', async () => {
        const response = await request(app)
          .get('/api/communities/2/phases')
          .set('Authorization', `Bearer ${communityAdminToken}`);

        expect(response.status).toBe(403);
        expect(response.body.error).toBe('无权访问该小区');
      });

      it('小区管理员可以访问自己小区的期数', async () => {
        const mockPhases = [{ id: 1, name: '一期', code: 'P1' }];
        pool.query.mockResolvedValueOnce([mockPhases]);

        const response = await request(app)
          .get('/api/communities/1/phases')
          .set('Authorization', `Bearer ${communityAdminToken}`);

        expect(response.status).toBe(200);
      });

      it('应该处理服务器错误', async () => {
        pool.query.mockRejectedValueOnce(new Error('Database error'));

        const response = await request(app)
          .get('/api/communities/1/phases')
          .set('Authorization', `Bearer ${superAdminToken}`);

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('服务器内部错误，请稍后重试');
      });
    });

    describe('POST /api/communities/:communityId/phases', () => {
      it('应该拒绝普通用户创建期数', async () => {
        const response = await request(app)
          .post('/api/communities/1/phases')
          .set('Authorization', `Bearer ${communityUserToken}`)
          .send({ name: '一期', code: 'P1' });

        expect(response.status).toBe(403);
        expect(response.body.error).toBe('需要管理员权限');
      });

      it('小区管理员无权在其他小区创建期数', async () => {
        const response = await request(app)
          .post('/api/communities/2/phases')
          .set('Authorization', `Bearer ${communityAdminToken}`)
          .send({ name: '一期', code: 'P1' });

        expect(response.status).toBe(403);
        expect(response.body.error).toBe('无权管理该小区');
      });

      it('应该拒绝空的名称或代码', async () => {
        const response = await request(app)
          .post('/api/communities/1/phases')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .send({ name: '', code: '' });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('期数名称和代码不能为空');
      });

      it('应该成功创建期数', async () => {
        pool.query
          .mockResolvedValueOnce([{ insertId: 1 }])
          .mockResolvedValueOnce([{ insertId: 1 }]); // 记录日志

        const response = await request(app)
          .post('/api/communities/1/phases')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .send({ name: '三期', code: 'P3', description: '第三期' });

        expect(response.status).toBe(201);
        expect(response.body.name).toBe('三期');
        expect(response.body.code).toBe('P3');
      });

      it('小区管理员可以在自己小区创建期数', async () => {
        pool.query
          .mockResolvedValueOnce([{ insertId: 1 }])
          .mockResolvedValueOnce([{ insertId: 1 }]); // 记录日志

        const response = await request(app)
          .post('/api/communities/1/phases')
          .set('Authorization', `Bearer ${communityAdminToken}`)
          .send({ name: '三期', code: 'P3' });

        expect(response.status).toBe(201);
      });

      it('应该拒绝重复的期数代码', async () => {
        const error = new Error('Duplicate entry');
        error.code = 'ER_DUP_ENTRY';
        pool.query.mockRejectedValueOnce(error);

        const response = await request(app)
          .post('/api/communities/1/phases')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .send({ name: '一期', code: 'P1' });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('该期数代码已存在');
      });

      it('应该处理服务器错误', async () => {
        pool.query.mockRejectedValueOnce(new Error('Database error'));

        const response = await request(app)
          .post('/api/communities/1/phases')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .send({ name: '三期', code: 'P3' });

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('服务器内部错误，请稍后重试');
      });
    });

    describe('PUT /api/communities/phases/:id', () => {
      it('应该拒绝普通用户更新期数', async () => {
        const response = await request(app)
          .put('/api/communities/phases/1')
          .set('Authorization', `Bearer ${communityUserToken}`)
          .send({ name: '更新' });

        expect(response.status).toBe(403);
        expect(response.body.error).toBe('需要管理员权限');
      });

      it('小区管理员无权更新其他小区的期数', async () => {
        pool.query.mockResolvedValueOnce([[{ id: 1, community_id: 2 }]]); // 不同小区

        const response = await request(app)
          .put('/api/communities/phases/1')
          .set('Authorization', `Bearer ${communityAdminToken}`)
          .send({ name: '更新' });

        expect(response.status).toBe(403);
        expect(response.body.error).toBe('无权管理该小区');
      });

      it('应该成功更新期数', async () => {
        pool.query
          .mockResolvedValueOnce([[{ id: 1, community_id: 1 }]])
          .mockResolvedValueOnce([{ affectedRows: 1 }])
          .mockResolvedValueOnce([{ insertId: 1 }]); // 记录日志

        const response = await request(app)
          .put('/api/communities/phases/1')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .send({ name: '一期（更新）', code: 'P1-NEW' });

        expect(response.status).toBe(200);
        expect(response.body.name).toBe('一期（更新）');
      });

      it('应该返回 404 如果期数不存在', async () => {
        pool.query.mockResolvedValueOnce([[]]);

        const response = await request(app)
          .put('/api/communities/phases/999')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .send({ name: '测试' });

        expect(response.status).toBe(404);
        expect(response.body.error).toBe('期数不存在');
      });

      it('应该拒绝重复的期数代码', async () => {
        pool.query.mockResolvedValueOnce([[{ id: 1, community_id: 1 }]]);
        const error = new Error('Duplicate entry');
        error.code = 'ER_DUP_ENTRY';
        pool.query.mockRejectedValueOnce(error);

        const response = await request(app)
          .put('/api/communities/phases/1')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .send({ name: '二期', code: 'P2' });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('该期数代码已存在');
      });

      it('应该处理服务器错误', async () => {
        pool.query.mockRejectedValueOnce(new Error('Database error'));

        const response = await request(app)
          .put('/api/communities/phases/1')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .send({ name: '测试' });

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('服务器内部错误，请稍后重试');
      });
    });

    describe('DELETE /api/communities/phases/:id', () => {
      it('应该拒绝普通用户删除期数', async () => {
        const response = await request(app)
          .delete('/api/communities/phases/1')
          .set('Authorization', `Bearer ${communityUserToken}`);

        expect(response.status).toBe(403);
        expect(response.body.error).toBe('需要管理员权限');
      });

      it('小区管理员无权删除其他小区的期数', async () => {
        pool.query.mockResolvedValueOnce([[{ id: 1, name: '一期', code: 'P1', community_id: 2 }]]);

        const response = await request(app)
          .delete('/api/communities/phases/1')
          .set('Authorization', `Bearer ${communityAdminToken}`);

        expect(response.status).toBe(403);
        expect(response.body.error).toBe('无权管理该小区');
      });

      it('应该成功删除期数', async () => {
        pool.query
          .mockResolvedValueOnce([[{ id: 1, name: '一期', code: 'P1', community_id: 1 }]])
          .mockResolvedValueOnce([{ affectedRows: 1 }])
          .mockResolvedValueOnce([{ insertId: 1 }]); // 记录日志

        const response = await request(app)
          .delete('/api/communities/phases/1')
          .set('Authorization', `Bearer ${superAdminToken}`);

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('删除成功');
      });

      it('应该返回 404 如果期数不存在', async () => {
        pool.query.mockResolvedValueOnce([[]]);

        const response = await request(app)
          .delete('/api/communities/phases/999')
          .set('Authorization', `Bearer ${superAdminToken}`);

        expect(response.status).toBe(404);
        expect(response.body.error).toBe('期数不存在');
      });

      it('应该处理服务器错误', async () => {
        pool.query.mockRejectedValueOnce(new Error('Database error'));

        const response = await request(app)
          .delete('/api/communities/phases/1')
          .set('Authorization', `Bearer ${superAdminToken}`);

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('服务器内部错误，请稍后重试');
      });
    });
  });
});
