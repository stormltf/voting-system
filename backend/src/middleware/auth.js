const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('FATAL ERROR: JWT_SECRET environment variable is not defined.');
  process.exit(1);
}

// 角色常量定义
const ROLES = {
  SUPER_ADMIN: 'super_admin',
  COMMUNITY_ADMIN: 'community_admin',
  COMMUNITY_USER: 'community_user'
};

// 角色权限级别（数字越大权限越高）
const ROLE_LEVELS = {
  [ROLES.COMMUNITY_USER]: 1,
  [ROLES.COMMUNITY_ADMIN]: 2,
  [ROLES.SUPER_ADMIN]: 3
};

// JWT 验证中间件
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未提供认证令牌' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: '令牌已过期' });
    }
    return res.status(401).json({ error: '无效的令牌' });
  }
}

// 超级管理员权限验证
function superAdminMiddleware(req, res, next) {
  if (req.user.role !== ROLES.SUPER_ADMIN) {
    return res.status(403).json({ error: '需要超级管理员权限' });
  }
  next();
}

// 管理员权限验证（包括超级管理员和小区管理员）
function adminMiddleware(req, res, next) {
  if (req.user.role !== ROLES.SUPER_ADMIN && req.user.role !== ROLES.COMMUNITY_ADMIN) {
    return res.status(403).json({ error: '需要管理员权限' });
  }
  next();
}

// 小区访问权限验证（检查用户是否有权访问指定小区）
// communityIdExtractor: 从请求中提取 community_id 的函数
function communityAccessMiddleware(communityIdExtractor) {
  return (req, res, next) => {
    // 超级管理员可以访问所有小区
    if (req.user.role === ROLES.SUPER_ADMIN) {
      return next();
    }

    const communityId = communityIdExtractor(req);

    // 如果没有指定小区ID，检查是否在查询自己的小区
    if (!communityId) {
      // 非超级管理员必须指定小区或只能访问自己的小区
      req.communityFilter = req.user.communityId;
      return next();
    }

    // 检查用户是否属于该小区
    if (req.user.communityId !== parseInt(communityId)) {
      return res.status(403).json({ error: '无权访问该小区数据' });
    }

    next();
  };
}

// 小区管理权限验证（只有管理员可以修改数据）
function communityManageMiddleware(communityIdExtractor) {
  return (req, res, next) => {
    // 超级管理员可以管理所有小区
    if (req.user.role === ROLES.SUPER_ADMIN) {
      return next();
    }

    // 普通用户不能修改数据
    if (req.user.role === ROLES.COMMUNITY_USER) {
      return res.status(403).json({ error: '普通用户只有查看权限' });
    }

    const communityId = communityIdExtractor(req);

    // 小区管理员只能管理自己的小区
    if (communityId && req.user.communityId !== parseInt(communityId)) {
      return res.status(403).json({ error: '无权管理该小区数据' });
    }

    next();
  };
}

// 生成 JWT token
function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
      communityId: user.community_id || null
    },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

// 检查用户是否有足够的权限级别
function hasRoleLevel(userRole, requiredRole) {
  return (ROLE_LEVELS[userRole] || 0) >= (ROLE_LEVELS[requiredRole] || 0);
}

// 检查用户是否是超级管理员
function isSuperAdmin(user) {
  return user.role === ROLES.SUPER_ADMIN;
}

// 检查用户是否可以访问指定小区
function canAccessCommunity(user, communityId) {
  if (user.role === ROLES.SUPER_ADMIN) return true;
  return user.communityId === parseInt(communityId);
}

// 检查用户是否可以管理指定小区
function canManageCommunity(user, communityId) {
  if (user.role === ROLES.SUPER_ADMIN) return true;
  if (user.role === ROLES.COMMUNITY_USER) return false;
  return user.communityId === parseInt(communityId);
}

module.exports = {
  authMiddleware,
  adminMiddleware,
  superAdminMiddleware,
  communityAccessMiddleware,
  communityManageMiddleware,
  generateToken,
  ROLES,
  ROLE_LEVELS,
  hasRoleLevel,
  isSuperAdmin,
  canAccessCommunity,
  canManageCommunity
};
