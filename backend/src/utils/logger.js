const { pool } = require('../models/db');

/**
 * 操作日志记录工具
 * 用于记录用户在系统中的所有关键操作
 */

// 操作类型常量
const Actions = {
  // 认证相关
  LOGIN: 'login',
  LOGOUT: 'logout',
  CHANGE_PASSWORD: 'change_password',

  // CRUD 操作
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  IMPORT: 'import',

  // 批量操作
  BATCH_UPDATE: 'batch_update',
};

// 模块常量
const Modules = {
  AUTH: 'auth',
  USER: 'user',
  COMMUNITY: 'community',
  PHASE: 'phase',
  OWNER: 'owner',
  VOTE_ROUND: 'vote_round',
  VOTE: 'vote',
};

/**
 * 记录操作日志
 * @param {Object} logData - 日志数据
 * @param {number} logData.userId - 用户ID
 * @param {string} logData.username - 用户名
 * @param {string} logData.action - 操作类型
 * @param {string} logData.module - 模块名称
 * @param {string} [logData.targetType] - 目标类型
 * @param {number} [logData.targetId] - 目标ID
 * @param {string} [logData.targetName] - 目标名称
 * @param {string} [logData.details] - 详细信息
 * @param {string} [logData.ipAddress] - IP地址
 * @param {string} [logData.userAgent] - 用户代理
 */
async function logOperation(logData) {
  try {
    const {
      userId,
      username,
      action,
      module,
      targetType = null,
      targetId = null,
      targetName = null,
      details = null,
      ipAddress = null,
      userAgent = null,
    } = logData;

    await pool.query(
      `INSERT INTO operation_logs
       (user_id, username, action, module, target_type, target_id, target_name, details, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, username, action, module, targetType, targetId, targetName, details, ipAddress, userAgent]
    );
  } catch (error) {
    // 日志记录失败不应影响主业务流程，仅打印错误
    console.error('记录操作日志失败:', error);
  }
}

/**
 * 从请求对象获取客户端信息
 * @param {Object} req - Express 请求对象
 * @returns {Object} - 包含 ipAddress 和 userAgent
 */
function getClientInfo(req) {
  const ipAddress = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.headers['x-real-ip']
    || req.connection?.remoteAddress
    || req.socket?.remoteAddress
    || req.ip
    || '';

  const userAgent = req.headers['user-agent'] || '';

  return { ipAddress, userAgent };
}

/**
 * 创建日志记录器（带请求上下文）
 * @param {Object} req - Express 请求对象
 * @returns {Function} - 日志记录函数
 */
function createLogger(req) {
  const { ipAddress, userAgent } = getClientInfo(req);
  const user = req.user || {};

  return async function log(action, module, options = {}) {
    await logOperation({
      userId: user.id,
      username: user.username,
      action,
      module,
      targetType: options.targetType,
      targetId: options.targetId,
      targetName: options.targetName,
      details: options.details,
      ipAddress,
      userAgent,
    });
  };
}

module.exports = {
  logOperation,
  getClientInfo,
  createLogger,
  Actions,
  Modules,
};
