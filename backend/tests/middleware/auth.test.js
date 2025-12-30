const jwt = require('jsonwebtoken');
const { authMiddleware, adminMiddleware, generateToken } = require('../../src/middleware/auth');

describe('Auth Middleware', () => {
  let mockReq;
  let mockRes;
  let nextFunction;

  beforeEach(() => {
    mockReq = {
      headers: {},
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    nextFunction = jest.fn();
  });

  describe('authMiddleware', () => {
    it('应该拒绝没有 Authorization 头的请求', () => {
      authMiddleware(mockReq, mockRes, nextFunction);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: '未提供认证令牌' });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('应该拒绝不以 Bearer 开头的 Authorization 头', () => {
      mockReq.headers.authorization = 'Basic abc123';

      authMiddleware(mockReq, mockRes, nextFunction);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: '未提供认证令牌' });
    });

    it('应该拒绝无效的 token', () => {
      mockReq.headers.authorization = 'Bearer invalid-token';

      authMiddleware(mockReq, mockRes, nextFunction);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: '无效的令牌' });
    });

    it('应该接受有效的 token 并将用户信息附加到 req', () => {
      const user = { id: 1, username: 'testuser', role: 'admin' };
      const token = generateToken(user);
      mockReq.headers.authorization = `Bearer ${token}`;

      authMiddleware(mockReq, mockRes, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect(mockReq.user).toBeDefined();
      expect(mockReq.user.id).toBe(user.id);
      expect(mockReq.user.username).toBe(user.username);
      expect(mockReq.user.role).toBe(user.role);
    });

    it('应该拒绝过期的 token', () => {
      // 创建一个已过期的 token
      const expiredToken = jwt.sign(
        { id: 1, username: 'test', role: 'admin' },
        process.env.JWT_SECRET || 'test-secret-key',
        { expiresIn: '-1s' } // 已过期
      );
      mockReq.headers.authorization = `Bearer ${expiredToken}`;

      authMiddleware(mockReq, mockRes, nextFunction);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: '令牌已过期' });
    });
  });

  describe('adminMiddleware', () => {
    it('应该允许管理员通过', () => {
      mockReq.user = { id: 1, role: 'admin' };

      adminMiddleware(mockReq, mockRes, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });

    it('应该拒绝非管理员用户', () => {
      mockReq.user = { id: 2, role: 'staff' };

      adminMiddleware(mockReq, mockRes, nextFunction);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ error: '需要管理员权限' });
    });
  });

  describe('generateToken', () => {
    it('应该生成有效的 JWT token', () => {
      const user = { id: 1, username: 'testuser', role: 'admin' };
      const token = generateToken(user);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT 格式: header.payload.signature
    });

    it('生成的 token 应该可以被验证', () => {
      const user = { id: 1, username: 'testuser', role: 'admin' };
      const token = generateToken(user);

      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'test-secret-key');

      expect(decoded.id).toBe(user.id);
      expect(decoded.username).toBe(user.username);
      expect(decoded.role).toBe(user.role);
    });
  });
});
