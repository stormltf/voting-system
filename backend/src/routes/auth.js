const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../models/db');
const { authMiddleware, generateToken } = require('../middleware/auth');
const { createLogger, getClientInfo, logOperation, Actions, Modules } = require('../utils/logger');

const router = express.Router();

// 登录
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }

    const [users] = await pool.query(
      'SELECT * FROM users WHERE username = ?',
      [username]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const user = users[0];
    const isValid = await bcrypt.compare(password, user.password);

    if (!isValid) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const token = generateToken(user);

    // 记录登录日志
    const { ipAddress, userAgent } = getClientInfo(req);
    await logOperation({
      userId: user.id,
      username: user.username,
      action: Actions.LOGIN,
      module: Modules.AUTH,
      details: '用户登录成功',
      ipAddress,
      userAgent,
    });

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('登录错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取当前用户信息
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const [users] = await pool.query(
      'SELECT id, username, name, role, created_at FROM users WHERE id = ?',
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    res.json(users[0]);
  } catch (error) {
    console.error('获取用户信息错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 修改密码
router.put('/password', authMiddleware, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: '请提供旧密码和新密码' });
    }

    const [users] = await pool.query(
      'SELECT * FROM users WHERE id = ?',
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    const isValid = await bcrypt.compare(oldPassword, users[0].password);
    if (!isValid) {
      return res.status(401).json({ error: '旧密码错误' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query(
      'UPDATE users SET password = ? WHERE id = ?',
      [hashedPassword, req.user.id]
    );

    // 记录修改密码日志
    const log = createLogger(req);
    await log(Actions.CHANGE_PASSWORD, Modules.AUTH, {
      targetType: 'user',
      targetId: req.user.id,
      targetName: req.user.username,
      details: '修改个人密码',
    });

    res.json({ message: '密码修改成功' });
  } catch (error) {
    console.error('修改密码错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取用户列表（仅管理员）
router.get('/users', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: '需要管理员权限' });
    }

    const [users] = await pool.query(
      'SELECT id, username, name, role, created_at FROM users ORDER BY created_at DESC'
    );

    res.json(users);
  } catch (error) {
    console.error('获取用户列表错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 创建用户（仅管理员）
router.post('/users', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: '需要管理员权限' });
    }

    const { username, password, name, role } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)',
      [username, hashedPassword, name || username, role || 'staff']
    );

    // 记录创建用户日志
    const log = createLogger(req);
    await log(Actions.CREATE, Modules.USER, {
      targetType: 'user',
      targetId: result.insertId,
      targetName: username,
      details: `创建用户: ${name || username} (${role || 'staff'})`,
    });

    res.status(201).json({
      id: result.insertId,
      username,
      name: name || username,
      role: role || 'staff'
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: '用户名已存在' });
    }
    console.error('创建用户错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 更新用户（仅管理员）
router.put('/users/:id', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: '需要管理员权限' });
    }

    const { id } = req.params;
    const { name, role, password } = req.body;

    // 不能修改自己的角色
    if (parseInt(id) === req.user.id && role && role !== req.user.role) {
      return res.status(400).json({ error: '不能修改自己的角色' });
    }

    let query = 'UPDATE users SET name = ?, role = ?';
    let params = [name, role];

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      query += ', password = ?';
      params.push(hashedPassword);
    }

    query += ' WHERE id = ?';
    params.push(id);

    await pool.query(query, params);

    // 记录更新用户日志
    const log = createLogger(req);
    const changes = [];
    if (name) changes.push(`姓名: ${name}`);
    if (role) changes.push(`角色: ${role}`);
    if (password) changes.push('密码已重置');
    await log(Actions.UPDATE, Modules.USER, {
      targetType: 'user',
      targetId: parseInt(id),
      targetName: name,
      details: `更新用户信息: ${changes.join(', ')}`,
    });

    res.json({ message: '用户更新成功' });
  } catch (error) {
    console.error('更新用户错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 删除用户（仅管理员）
router.delete('/users/:id', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: '需要管理员权限' });
    }

    const { id } = req.params;

    // 不能删除自己
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: '不能删除自己' });
    }

    // 获取要删除的用户信息（用于日志）
    const [users] = await pool.query('SELECT username, name FROM users WHERE id = ?', [id]);
    const deletedUser = users[0];

    await pool.query('DELETE FROM users WHERE id = ?', [id]);

    // 记录删除用户日志
    const log = createLogger(req);
    await log(Actions.DELETE, Modules.USER, {
      targetType: 'user',
      targetId: parseInt(id),
      targetName: deletedUser?.username,
      details: `删除用户: ${deletedUser?.name || deletedUser?.username}`,
    });

    res.json({ message: '用户删除成功' });
  } catch (error) {
    console.error('删除用户错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
