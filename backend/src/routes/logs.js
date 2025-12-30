const express = require('express');
const { pool } = require('../models/db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// 获取操作日志列表（仅管理员）
router.get('/', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: '需要管理员权限' });
    }

    const {
      page = 1,
      limit = 20,
      user_id,
      action,
      module,
      start_date,
      end_date,
      search,
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    let whereClause = '1=1';
    const params = [];

    // 按用户筛选
    if (user_id) {
      whereClause += ' AND user_id = ?';
      params.push(user_id);
    }

    // 按操作类型筛选
    if (action) {
      whereClause += ' AND action = ?';
      params.push(action);
    }

    // 按模块筛选
    if (module) {
      whereClause += ' AND module = ?';
      params.push(module);
    }

    // 按日期范围筛选
    if (start_date) {
      whereClause += ' AND DATE(created_at) >= ?';
      params.push(start_date);
    }

    if (end_date) {
      whereClause += ' AND DATE(created_at) <= ?';
      params.push(end_date);
    }

    // 搜索（用户名、目标名称、详情）
    if (search) {
      whereClause += ' AND (username LIKE ? OR target_name LIKE ? OR details LIKE ?)';
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    // 获取总数
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM operation_logs WHERE ${whereClause}`,
      params
    );
    const total = countResult[0].total;

    // 获取日志列表
    const [logs] = await pool.query(
      `SELECT * FROM operation_logs
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    res.json({
      logs,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('获取操作日志错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取日志统计信息（仅管理员）
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: '需要管理员权限' });
    }

    const { days = 7 } = req.query;

    // 获取各操作类型的统计
    const [actionStats] = await pool.query(
      `SELECT action, COUNT(*) as count
       FROM operation_logs
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
       GROUP BY action
       ORDER BY count DESC`,
      [parseInt(days)]
    );

    // 获取各模块的统计
    const [moduleStats] = await pool.query(
      `SELECT module, COUNT(*) as count
       FROM operation_logs
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
       GROUP BY module
       ORDER BY count DESC`,
      [parseInt(days)]
    );

    // 获取每日操作数量
    const [dailyStats] = await pool.query(
      `SELECT DATE(created_at) as date, COUNT(*) as count
       FROM operation_logs
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
       GROUP BY DATE(created_at)
       ORDER BY date`,
      [parseInt(days)]
    );

    // 获取活跃用户
    const [userStats] = await pool.query(
      `SELECT username, COUNT(*) as count
       FROM operation_logs
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
       GROUP BY username
       ORDER BY count DESC
       LIMIT 10`,
      [parseInt(days)]
    );

    res.json({
      actionStats,
      moduleStats,
      dailyStats,
      userStats,
    });
  } catch (error) {
    console.error('获取日志统计错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取可用的筛选选项
router.get('/filters', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: '需要管理员权限' });
    }

    // 获取所有操作类型
    const [actions] = await pool.query(
      'SELECT DISTINCT action FROM operation_logs ORDER BY action'
    );

    // 获取所有模块
    const [modules] = await pool.query(
      'SELECT DISTINCT module FROM operation_logs ORDER BY module'
    );

    // 获取所有用户
    const [users] = await pool.query(
      'SELECT DISTINCT user_id, username FROM operation_logs WHERE username IS NOT NULL ORDER BY username'
    );

    res.json({
      actions: actions.map(a => a.action),
      modules: modules.map(m => m.module),
      users: users.map(u => ({ id: u.user_id, username: u.username })),
    });
  } catch (error) {
    console.error('获取筛选选项错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
