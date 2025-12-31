const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../models/db');
const { authMiddleware, superAdminMiddleware, adminMiddleware, isSuperAdmin, generateToken, ROLES } = require('../middleware/auth');
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
        role: user.role,
        communityId: user.community_id
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
      `SELECT u.id, u.username, u.name, u.role, u.community_id, u.created_at,
              c.name as community_name
       FROM users u
       LEFT JOIN communities c ON u.community_id = c.id
       WHERE u.id = ?`,
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    const user = users[0];
    res.json({
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      communityId: user.community_id,
      communityName: user.community_name,
      createdAt: user.created_at
    });
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

// 获取用户列表（超级管理员看所有，小区管理员看本小区）
router.get('/users', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    let query = `
      SELECT u.id, u.username, u.name, u.role, u.community_id, u.created_at,
             c.name as community_name
      FROM users u
      LEFT JOIN communities c ON u.community_id = c.id
    `;
    const params = [];

    // 小区管理员只能看本小区用户
    if (!isSuperAdmin(req.user)) {
      query += ' WHERE u.community_id = ?';
      params.push(req.user.communityId);
    }

    query += ' ORDER BY u.created_at DESC';

    const [users] = await pool.query(query, params);

    res.json(users.map(user => ({
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      communityId: user.community_id,
      communityName: user.community_name,
      createdAt: user.created_at
    })));
  } catch (error) {
    console.error('获取用户列表错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 创建用户（超级管理员可创建任意用户，小区管理员只能创建本小区普通用户）
router.post('/users', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { username, password, name, role, communityId } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }

    // 验证角色
    const validRoles = [ROLES.SUPER_ADMIN, ROLES.COMMUNITY_ADMIN, ROLES.COMMUNITY_USER];
    const userRole = role || ROLES.COMMUNITY_USER;
    if (!validRoles.includes(userRole)) {
      return res.status(400).json({ error: '无效的角色类型' });
    }

    // 小区管理员只能创建本小区的普通用户
    if (!isSuperAdmin(req.user)) {
      if (userRole !== ROLES.COMMUNITY_USER) {
        return res.status(403).json({ error: '小区管理员只能创建普通用户' });
      }
      // 小区管理员创建的用户必须属于自己的小区
      if (communityId && communityId !== req.user.communityId) {
        return res.status(403).json({ error: '只能创建本小区的用户' });
      }
    }

    // 非超级管理员必须指定小区
    if (userRole !== ROLES.SUPER_ADMIN && !communityId) {
      // 如果是小区管理员创建用户，自动使用自己的小区
      if (!isSuperAdmin(req.user)) {
        var finalCommunityId = req.user.communityId;
      } else {
        return res.status(400).json({ error: '小区管理员和普通用户必须指定所属小区' });
      }
    } else {
      // 超级管理员不能指定小区
      var finalCommunityId = userRole === ROLES.SUPER_ADMIN ? null : communityId;
    }

    // 验证小区是否存在
    if (finalCommunityId) {
      const [communities] = await pool.query('SELECT id FROM communities WHERE id = ?', [finalCommunityId]);
      if (communities.length === 0) {
        return res.status(400).json({ error: '指定的小区不存在' });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO users (username, password, name, role, community_id) VALUES (?, ?, ?, ?, ?)',
      [username, hashedPassword, name || username, userRole, finalCommunityId]
    );

    // 记录创建用户日志
    const log = createLogger(req);
    await log(Actions.CREATE, Modules.USER, {
      targetType: 'user',
      targetId: result.insertId,
      targetName: username,
      details: `创建用户: ${name || username} (${userRole})${finalCommunityId ? `, 小区ID: ${finalCommunityId}` : ''}`,
    });

    res.status(201).json({
      id: result.insertId,
      username,
      name: name || username,
      role: userRole,
      communityId: finalCommunityId
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: '用户名已存在' });
    }
    console.error('创建用户错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 更新用户（超级管理员可更新任意用户，小区管理员只能更新本小区普通用户）
router.put('/users/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, role, password, communityId } = req.body;

    // 不能修改自己的角色
    if (parseInt(id) === req.user.id && role && role !== req.user.role) {
      return res.status(400).json({ error: '不能修改自己的角色' });
    }

    // 获取当前用户信息
    const [existingUsers] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
    if (existingUsers.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }
    const existingUser = existingUsers[0];

    // 小区管理员权限检查
    if (!isSuperAdmin(req.user)) {
      // 只能修改本小区用户
      if (existingUser.community_id !== req.user.communityId) {
        return res.status(403).json({ error: '只能修改本小区的用户' });
      }
      // 不能修改管理员
      if (existingUser.role !== ROLES.COMMUNITY_USER) {
        return res.status(403).json({ error: '无权修改管理员用户' });
      }
      // 不能修改角色
      if (role && role !== ROLES.COMMUNITY_USER) {
        return res.status(403).json({ error: '小区管理员不能修改用户角色' });
      }
      // 不能修改小区
      if (communityId && communityId !== req.user.communityId) {
        return res.status(403).json({ error: '不能将用户转移到其他小区' });
      }
    }

    // 验证角色
    if (role) {
      const validRoles = [ROLES.SUPER_ADMIN, ROLES.COMMUNITY_ADMIN, ROLES.COMMUNITY_USER];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ error: '无效的角色类型' });
      }
    }

    const finalRole = role || existingUser.role;

    // 非超级管理员必须有小区
    let finalCommunityId;
    if (finalRole === ROLES.SUPER_ADMIN) {
      finalCommunityId = null;
    } else {
      finalCommunityId = communityId !== undefined ? communityId : existingUser.community_id;
      if (!finalCommunityId) {
        return res.status(400).json({ error: '小区管理员和普通用户必须指定所属小区' });
      }
      // 验证小区是否存在
      const [communities] = await pool.query('SELECT id FROM communities WHERE id = ?', [finalCommunityId]);
      if (communities.length === 0) {
        return res.status(400).json({ error: '指定的小区不存在' });
      }
    }

    let query = 'UPDATE users SET name = ?, role = ?, community_id = ?';
    let params = [name || existingUser.name, finalRole, finalCommunityId];

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
    if (communityId !== undefined) changes.push(`小区ID: ${finalCommunityId}`);
    if (password) changes.push('密码已重置');
    await log(Actions.UPDATE, Modules.USER, {
      targetType: 'user',
      targetId: parseInt(id),
      targetName: name || existingUser.name,
      details: `更新用户信息: ${changes.join(', ')}`,
    });

    res.json({ message: '用户更新成功' });
  } catch (error) {
    console.error('更新用户错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 删除用户（超级管理员可删除任意用户，小区管理员只能删除本小区普通用户）
router.delete('/users/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // 不能删除自己
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: '不能删除自己' });
    }

    // 获取要删除的用户信息
    const [users] = await pool.query('SELECT username, name, role, community_id FROM users WHERE id = ?', [id]);
    const deletedUser = users[0];

    if (!deletedUser) {
      return res.status(404).json({ error: '用户不存在' });
    }

    // 小区管理员权限检查
    if (!isSuperAdmin(req.user)) {
      // 只能删除本小区用户
      if (deletedUser.community_id !== req.user.communityId) {
        return res.status(403).json({ error: '只能删除本小区的用户' });
      }
      // 不能删除管理员
      if (deletedUser.role !== ROLES.COMMUNITY_USER) {
        return res.status(403).json({ error: '无权删除管理员用户' });
      }
    }

    await pool.query('DELETE FROM users WHERE id = ?', [id]);

    // 记录删除用户日志
    const log = createLogger(req);
    await log(Actions.DELETE, Modules.USER, {
      targetType: 'user',
      targetId: parseInt(id),
      targetName: deletedUser.username,
      details: `删除用户: ${deletedUser.name || deletedUser.username}`,
    });

    res.json({ message: '用户删除成功' });
  } catch (error) {
    console.error('删除用户错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
