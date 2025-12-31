const jwt = require('jsonwebtoken');
const {
  authMiddleware,
  superAdminMiddleware,
  adminMiddleware,
  communityAccessMiddleware,
  communityManageMiddleware,
  generateToken,
  ROLES,
  ROLE_LEVELS,
  hasRoleLevel,
  isSuperAdmin,
  canAccessCommunity,
  canManageCommunity
} = require('../../src/middleware/auth');

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

  describe('ROLES 常量', () => {
    it('应该定义三种角色', () => {
      expect(ROLES.SUPER_ADMIN).toBe('super_admin');
      expect(ROLES.COMMUNITY_ADMIN).toBe('community_admin');
      expect(ROLES.COMMUNITY_USER).toBe('community_user');
    });
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
      const user = { id: 1, username: 'testuser', role: ROLES.SUPER_ADMIN, communityId: null };
      const token = generateToken(user);
      mockReq.headers.authorization = `Bearer ${token}`;

      authMiddleware(mockReq, mockRes, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect(mockReq.user).toBeDefined();
      expect(mockReq.user.id).toBe(user.id);
      expect(mockReq.user.username).toBe(user.username);
      expect(mockReq.user.role).toBe(user.role);
    });

    it('应该正确传递 communityId', () => {
      // generateToken 使用 community_id (数据库字段名)
      const user = { id: 2, username: 'admin1', role: ROLES.COMMUNITY_ADMIN, community_id: 5 };
      const token = generateToken(user);
      mockReq.headers.authorization = `Bearer ${token}`;

      authMiddleware(mockReq, mockRes, nextFunction);

      expect(mockReq.user.communityId).toBe(5);
    });

    it('应该拒绝过期的 token', () => {
      const expiredToken = jwt.sign(
        { id: 1, username: 'test', role: ROLES.SUPER_ADMIN },
        process.env.JWT_SECRET || 'test-secret-key',
        { expiresIn: '-1s' }
      );
      mockReq.headers.authorization = `Bearer ${expiredToken}`;

      authMiddleware(mockReq, mockRes, nextFunction);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: '令牌已过期' });
    });
  });

  describe('superAdminMiddleware', () => {
    it('应该允许超级管理员通过', () => {
      mockReq.user = { id: 1, role: ROLES.SUPER_ADMIN };

      superAdminMiddleware(mockReq, mockRes, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });

    it('应该拒绝小区管理员', () => {
      mockReq.user = { id: 2, role: ROLES.COMMUNITY_ADMIN, communityId: 1 };

      superAdminMiddleware(mockReq, mockRes, nextFunction);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ error: '需要超级管理员权限' });
    });

    it('应该拒绝普通用户', () => {
      mockReq.user = { id: 3, role: ROLES.COMMUNITY_USER, communityId: 1 };

      superAdminMiddleware(mockReq, mockRes, nextFunction);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });
  });

  describe('adminMiddleware', () => {
    it('应该允许超级管理员通过', () => {
      mockReq.user = { id: 1, role: ROLES.SUPER_ADMIN };

      adminMiddleware(mockReq, mockRes, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });

    it('应该允许小区管理员通过', () => {
      mockReq.user = { id: 2, role: ROLES.COMMUNITY_ADMIN, communityId: 1 };

      adminMiddleware(mockReq, mockRes, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });

    it('应该拒绝普通用户', () => {
      mockReq.user = { id: 3, role: ROLES.COMMUNITY_USER, communityId: 1 };

      adminMiddleware(mockReq, mockRes, nextFunction);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ error: '需要管理员权限' });
    });
  });

  describe('isSuperAdmin', () => {
    it('超级管理员应返回 true', () => {
      const user = { role: ROLES.SUPER_ADMIN };
      expect(isSuperAdmin(user)).toBe(true);
    });

    it('小区管理员应返回 false', () => {
      const user = { role: ROLES.COMMUNITY_ADMIN };
      expect(isSuperAdmin(user)).toBe(false);
    });

    it('普通用户应返回 false', () => {
      const user = { role: ROLES.COMMUNITY_USER };
      expect(isSuperAdmin(user)).toBe(false);
    });
  });

  describe('canAccessCommunity', () => {
    it('超级管理员可以访问任何小区', () => {
      const user = { role: ROLES.SUPER_ADMIN, communityId: null };
      expect(canAccessCommunity(user, 1)).toBe(true);
      expect(canAccessCommunity(user, 2)).toBe(true);
      expect(canAccessCommunity(user, 999)).toBe(true);
    });

    it('小区管理员只能访问自己的小区', () => {
      const user = { role: ROLES.COMMUNITY_ADMIN, communityId: 1 };
      expect(canAccessCommunity(user, 1)).toBe(true);
      expect(canAccessCommunity(user, 2)).toBe(false);
    });

    it('普通用户只能访问自己的小区', () => {
      const user = { role: ROLES.COMMUNITY_USER, communityId: 3 };
      expect(canAccessCommunity(user, 3)).toBe(true);
      expect(canAccessCommunity(user, 1)).toBe(false);
    });
  });

  describe('canManageCommunity', () => {
    it('超级管理员可以管理任何小区', () => {
      const user = { role: ROLES.SUPER_ADMIN, communityId: null };
      expect(canManageCommunity(user, 1)).toBe(true);
      expect(canManageCommunity(user, 999)).toBe(true);
    });

    it('小区管理员只能管理自己的小区', () => {
      const user = { role: ROLES.COMMUNITY_ADMIN, communityId: 1 };
      expect(canManageCommunity(user, 1)).toBe(true);
      expect(canManageCommunity(user, 2)).toBe(false);
    });

    it('普通用户不能管理任何小区', () => {
      const user = { role: ROLES.COMMUNITY_USER, communityId: 1 };
      expect(canManageCommunity(user, 1)).toBe(false);
      expect(canManageCommunity(user, 2)).toBe(false);
    });
  });

  describe('generateToken', () => {
    it('应该生成有效的 JWT token', () => {
      const user = { id: 1, username: 'testuser', role: ROLES.SUPER_ADMIN, communityId: null };
      const token = generateToken(user);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    it('生成的 token 应该包含 communityId', () => {
      // generateToken 使用 community_id (数据库字段名)，生成的 token 使用 communityId (驼峰)
      const user = { id: 2, username: 'admin1', role: ROLES.COMMUNITY_ADMIN, community_id: 5 };
      const token = generateToken(user);

      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'test-secret-key');

      expect(decoded.id).toBe(user.id);
      expect(decoded.username).toBe(user.username);
      expect(decoded.role).toBe(user.role);
      expect(decoded.communityId).toBe(5);
    });

    it('超级管理员的 communityId 应为 null', () => {
      const user = { id: 1, username: 'superadmin', role: ROLES.SUPER_ADMIN, community_id: null };
      const token = generateToken(user);

      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'test-secret-key');

      expect(decoded.communityId).toBeNull();
    });
  });

  describe('ROLE_LEVELS', () => {
    it('应该定义正确的权限级别', () => {
      expect(ROLE_LEVELS[ROLES.COMMUNITY_USER]).toBe(1);
      expect(ROLE_LEVELS[ROLES.COMMUNITY_ADMIN]).toBe(2);
      expect(ROLE_LEVELS[ROLES.SUPER_ADMIN]).toBe(3);
    });
  });

  describe('hasRoleLevel', () => {
    it('超级管理员应该有所有权限', () => {
      expect(hasRoleLevel(ROLES.SUPER_ADMIN, ROLES.COMMUNITY_USER)).toBe(true);
      expect(hasRoleLevel(ROLES.SUPER_ADMIN, ROLES.COMMUNITY_ADMIN)).toBe(true);
      expect(hasRoleLevel(ROLES.SUPER_ADMIN, ROLES.SUPER_ADMIN)).toBe(true);
    });

    it('小区管理员应该有用户权限但没有超管权限', () => {
      expect(hasRoleLevel(ROLES.COMMUNITY_ADMIN, ROLES.COMMUNITY_USER)).toBe(true);
      expect(hasRoleLevel(ROLES.COMMUNITY_ADMIN, ROLES.COMMUNITY_ADMIN)).toBe(true);
      expect(hasRoleLevel(ROLES.COMMUNITY_ADMIN, ROLES.SUPER_ADMIN)).toBe(false);
    });

    it('普通用户只有基本权限', () => {
      expect(hasRoleLevel(ROLES.COMMUNITY_USER, ROLES.COMMUNITY_USER)).toBe(true);
      expect(hasRoleLevel(ROLES.COMMUNITY_USER, ROLES.COMMUNITY_ADMIN)).toBe(false);
      expect(hasRoleLevel(ROLES.COMMUNITY_USER, ROLES.SUPER_ADMIN)).toBe(false);
    });

    it('未知角色应返回 false', () => {
      expect(hasRoleLevel('unknown', ROLES.COMMUNITY_USER)).toBe(false);
    });
  });

  describe('communityAccessMiddleware', () => {
    it('超级管理员可以访问所有小区', () => {
      const middleware = communityAccessMiddleware((req) => req.params.communityId);
      mockReq.user = { role: ROLES.SUPER_ADMIN };
      mockReq.params = { communityId: '5' };

      middleware(mockReq, mockRes, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });

    it('没有指定小区ID时应设置 communityFilter', () => {
      const middleware = communityAccessMiddleware((req) => req.params.communityId);
      mockReq.user = { role: ROLES.COMMUNITY_ADMIN, communityId: 3 };
      mockReq.params = {};

      middleware(mockReq, mockRes, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect(mockReq.communityFilter).toBe(3);
    });

    it('用户尝试访问其他小区应被拒绝', () => {
      const middleware = communityAccessMiddleware((req) => req.params.communityId);
      mockReq.user = { role: ROLES.COMMUNITY_ADMIN, communityId: 1 };
      mockReq.params = { communityId: '5' };

      middleware(mockReq, mockRes, nextFunction);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ error: '无权访问该小区数据' });
    });

    it('用户访问自己的小区应被允许', () => {
      const middleware = communityAccessMiddleware((req) => req.params.communityId);
      mockReq.user = { role: ROLES.COMMUNITY_ADMIN, communityId: 5 };
      mockReq.params = { communityId: '5' };

      middleware(mockReq, mockRes, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });
  });

  describe('communityManageMiddleware', () => {
    it('超级管理员可以管理所有小区', () => {
      const middleware = communityManageMiddleware((req) => req.params.communityId);
      mockReq.user = { role: ROLES.SUPER_ADMIN };
      mockReq.params = { communityId: '5' };

      middleware(mockReq, mockRes, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });

    it('普通用户不能管理任何小区', () => {
      const middleware = communityManageMiddleware((req) => req.params.communityId);
      mockReq.user = { role: ROLES.COMMUNITY_USER, communityId: 1 };
      mockReq.params = { communityId: '1' };

      middleware(mockReq, mockRes, nextFunction);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ error: '普通用户只有查看权限' });
    });

    it('小区管理员不能管理其他小区', () => {
      const middleware = communityManageMiddleware((req) => req.params.communityId);
      mockReq.user = { role: ROLES.COMMUNITY_ADMIN, communityId: 1 };
      mockReq.params = { communityId: '5' };

      middleware(mockReq, mockRes, nextFunction);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ error: '无权管理该小区数据' });
    });

    it('小区管理员可以管理自己的小区', () => {
      const middleware = communityManageMiddleware((req) => req.params.communityId);
      mockReq.user = { role: ROLES.COMMUNITY_ADMIN, communityId: 5 };
      mockReq.params = { communityId: '5' };

      middleware(mockReq, mockRes, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });

    it('没有指定小区ID时小区管理员应被允许', () => {
      const middleware = communityManageMiddleware((req) => req.params.communityId);
      mockReq.user = { role: ROLES.COMMUNITY_ADMIN, communityId: 1 };
      mockReq.params = {};

      middleware(mockReq, mockRes, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });
  });
});
