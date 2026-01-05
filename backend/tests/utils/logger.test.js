// Mock 数据库模块
jest.mock('../../src/models/db', () => require('../mocks/db'));

const { pool } = require('../../src/models/db');
const { logOperation, getClientInfo, createLogger, Actions, Modules } = require('../../src/utils/logger');

describe('Logger Utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  describe('logOperation', () => {
    it('应该成功记录操作日志', async () => {
      pool.query.mockResolvedValueOnce([{ insertId: 1 }]);

      await logOperation({
        userId: 1,
        username: 'admin',
        action: Actions.CREATE,
        module: Modules.OWNER,
        targetType: 'owner',
        targetId: 123,
        targetName: '张三',
        details: '创建业主',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      });

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO operation_logs'),
        [1, 'admin', 'create', 'owner', 'owner', 123, '张三', '创建业主', '192.168.1.1', 'Mozilla/5.0']
      );
    });

    it('应该使用默认值处理可选参数', async () => {
      pool.query.mockResolvedValueOnce([{ insertId: 1 }]);

      await logOperation({
        userId: 1,
        username: 'admin',
        action: Actions.LOGIN,
        module: Modules.AUTH,
      });

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO operation_logs'),
        [1, 'admin', 'login', 'auth', null, null, null, null, null, null]
      );
    });

    it('应该捕获数据库错误而不抛出异常', async () => {
      pool.query.mockRejectedValueOnce(new Error('Database error'));

      // 不应该抛出异常
      await expect(logOperation({
        userId: 1,
        username: 'admin',
        action: Actions.CREATE,
        module: Modules.OWNER,
      })).resolves.toBeUndefined();

      expect(console.error).toHaveBeenCalledWith('记录操作日志失败:', expect.any(Error));
    });
  });

  describe('getClientInfo', () => {
    it('应该从 x-forwarded-for 获取 IP', () => {
      const req = {
        headers: {
          'x-forwarded-for': '192.168.1.1, 10.0.0.1',
          'user-agent': 'Mozilla/5.0',
        },
      };

      const info = getClientInfo(req);
      expect(info.ipAddress).toBe('192.168.1.1');
      expect(info.userAgent).toBe('Mozilla/5.0');
    });

    it('应该从 x-real-ip 获取 IP', () => {
      const req = {
        headers: {
          'x-real-ip': '10.0.0.1',
          'user-agent': 'Test Agent',
        },
      };

      const info = getClientInfo(req);
      expect(info.ipAddress).toBe('10.0.0.1');
    });

    it('应该从 connection.remoteAddress 获取 IP', () => {
      const req = {
        headers: {},
        connection: { remoteAddress: '127.0.0.1' },
      };

      const info = getClientInfo(req);
      expect(info.ipAddress).toBe('127.0.0.1');
    });

    it('应该从 socket.remoteAddress 获取 IP', () => {
      const req = {
        headers: {},
        socket: { remoteAddress: '::1' },
      };

      const info = getClientInfo(req);
      expect(info.ipAddress).toBe('::1');
    });

    it('应该从 req.ip 获取 IP', () => {
      const req = {
        headers: {},
        ip: '172.16.0.1',
      };

      const info = getClientInfo(req);
      expect(info.ipAddress).toBe('172.16.0.1');
    });

    it('应该处理空请求头', () => {
      const req = {
        headers: {},
      };

      const info = getClientInfo(req);
      expect(info.ipAddress).toBe('');
      expect(info.userAgent).toBe('');
    });
  });

  describe('createLogger', () => {
    it('应该创建带有请求上下文的日志记录器', async () => {
      pool.query.mockResolvedValueOnce([{ insertId: 1 }]);

      const req = {
        headers: {
          'x-forwarded-for': '192.168.1.1',
          'user-agent': 'Test Agent',
        },
        user: { id: 1, username: 'admin' },
      };

      const log = createLogger(req);
      await log(Actions.UPDATE, Modules.VOTE, {
        targetType: 'vote',
        targetId: 100,
        details: '更新投票状态',
      });

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO operation_logs'),
        [1, 'admin', 'update', 'vote', 'vote', 100, null, '更新投票状态', '192.168.1.1', 'Test Agent']
      );
    });

    it('应该处理没有用户信息的请求', async () => {
      pool.query.mockResolvedValueOnce([{ insertId: 1 }]);

      const req = {
        headers: {},
      };

      const log = createLogger(req);
      await log(Actions.LOGIN, Modules.AUTH);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO operation_logs'),
        [undefined, undefined, 'login', 'auth', null, null, null, null, '', '']
      );
    });
  });

  describe('Constants', () => {
    it('Actions 应该包含所有操作类型', () => {
      expect(Actions.LOGIN).toBe('login');
      expect(Actions.LOGOUT).toBe('logout');
      expect(Actions.CHANGE_PASSWORD).toBe('change_password');
      expect(Actions.CREATE).toBe('create');
      expect(Actions.UPDATE).toBe('update');
      expect(Actions.DELETE).toBe('delete');
      expect(Actions.IMPORT).toBe('import');
      expect(Actions.BATCH_UPDATE).toBe('batch_update');
    });

    it('Modules 应该包含所有模块', () => {
      expect(Modules.AUTH).toBe('auth');
      expect(Modules.USER).toBe('user');
      expect(Modules.COMMUNITY).toBe('community');
      expect(Modules.PHASE).toBe('phase');
      expect(Modules.OWNER).toBe('owner');
      expect(Modules.VOTE_ROUND).toBe('vote_round');
      expect(Modules.VOTE).toBe('vote');
    });
  });
});
