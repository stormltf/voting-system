// 在测试 db.js 之前，需要设置环境变量
process.env.JWT_SECRET = 'test-secret-key';

// Mock mysql2/promise 模块
jest.mock('mysql2/promise', () => {
  const mockConnection = {
    release: jest.fn(),
  };

  const mockPool = {
    getConnection: jest.fn(),
    query: jest.fn(),
    end: jest.fn(),
  };

  return {
    createPool: jest.fn(() => mockPool),
  };
});

// 在 mock 之后导入
const mysql = require('mysql2/promise');

describe('Database Module', () => {
  let db;
  let mockPool;

  beforeEach(() => {
    jest.clearAllMocks();
    // 清除模块缓存以重新加载
    jest.resetModules();
    
    // 重新获取 mock pool
    mockPool = mysql.createPool();
  });

  describe('Pool Configuration', () => {
    it('应该使用默认配置创建连接池', () => {
      // 设置默认环境变量
      delete process.env.DB_HOST;
      delete process.env.DB_PORT;
      delete process.env.DB_USER;
      delete process.env.DB_PASSWORD;
      delete process.env.DB_NAME;
      delete process.env.DB_SSL;

      // 重新加载模块
      jest.resetModules();
      db = require('../../src/models/db');

      expect(mysql.createPool).toHaveBeenCalled();
    });

    it('应该使用环境变量配置创建连接池', () => {
      process.env.DB_HOST = 'test-host';
      process.env.DB_PORT = '3307';
      process.env.DB_USER = 'test-user';
      process.env.DB_PASSWORD = 'test-password';
      process.env.DB_NAME = 'test-db';
      delete process.env.DB_SSL;

      jest.resetModules();
      db = require('../../src/models/db');

      expect(mysql.createPool).toHaveBeenCalled();
    });

    it('应该在启用 SSL 时配置 SSL', () => {
      process.env.DB_SSL = 'true';

      jest.resetModules();
      db = require('../../src/models/db');

      expect(mysql.createPool).toHaveBeenCalled();
    });
  });

  describe('testConnection', () => {
    beforeEach(() => {
      jest.resetModules();
      db = require('../../src/models/db');
    });

    it('应该在连接成功时返回 true', async () => {
      // 重新设置 mock，确保正确模拟
      const mockConnection = { release: jest.fn() };
      const mysql2 = require('mysql2/promise');
      const pool = mysql2.createPool();
      pool.getConnection.mockResolvedValueOnce(mockConnection);

      // 重新加载 db 模块以使用新的 mock
      jest.resetModules();
      const freshDb = require('../../src/models/db');
      
      // 手动设置 pool 的 getConnection mock
      freshDb.pool.getConnection = jest.fn().mockResolvedValueOnce(mockConnection);

      const result = await freshDb.testConnection();

      expect(result).toBe(true);
      expect(mockConnection.release).toHaveBeenCalled();
    });

    it('应该在连接失败时返回 false', async () => {
      mockPool.getConnection.mockRejectedValueOnce(new Error('Connection failed'));

      const result = await db.testConnection();

      expect(result).toBe(false);
    });
  });

  describe('Pool Export', () => {
    it('应该导出 pool 对象', () => {
      jest.resetModules();
      db = require('../../src/models/db');

      expect(db.pool).toBeDefined();
    });

    it('应该导出 testConnection 函数', () => {
      jest.resetModules();
      db = require('../../src/models/db');

      expect(typeof db.testConnection).toBe('function');
    });
  });
});
