const express = require('express');
const { pool } = require('../models/db');
const { authMiddleware } = require('../middleware/auth');
const { createLogger, Actions, Modules } = require('../utils/logger');

const router = express.Router();

// 获取所有小区
router.get('/', authMiddleware, async (req, res) => {
  try {
    const [communities] = await pool.query(`
      SELECT c.*,
        (SELECT COUNT(*) FROM phases WHERE community_id = c.id) as phase_count,
        (SELECT COUNT(*) FROM owners o
         JOIN phases p ON o.phase_id = p.id
         WHERE p.community_id = c.id) as owner_count
      FROM communities c
      ORDER BY c.created_at DESC
    `);
    res.json(communities);
  } catch (error) {
    console.error('获取小区列表错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取单个小区详情
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const [communities] = await pool.query(
      'SELECT * FROM communities WHERE id = ?',
      [req.params.id]
    );

    if (communities.length === 0) {
      return res.status(404).json({ error: '小区不存在' });
    }

    // 获取期数列表
    const [phases] = await pool.query(`
      SELECT p.*,
        (SELECT COUNT(*) FROM owners WHERE phase_id = p.id) as owner_count,
        (SELECT SUM(area) FROM owners WHERE phase_id = p.id) as total_area
      FROM phases p
      WHERE p.community_id = ?
      ORDER BY p.code
    `, [req.params.id]);

    res.json({
      ...communities[0],
      phases
    });
  } catch (error) {
    console.error('获取小区详情错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 创建小区
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, address, description } = req.body;

    if (!name) {
      return res.status(400).json({ error: '小区名称不能为空' });
    }

    const [result] = await pool.query(
      'INSERT INTO communities (name, address, description) VALUES (?, ?, ?)',
      [name, address, description]
    );

    // 记录日志
    const log = createLogger(req);
    await log(Actions.CREATE, Modules.COMMUNITY, {
      targetType: 'community',
      targetId: result.insertId,
      targetName: name,
      details: `创建小区: ${name}`,
    });

    res.status(201).json({
      id: result.insertId,
      name,
      address,
      description
    });
  } catch (error) {
    console.error('创建小区错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 更新小区
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { name, address, description } = req.body;

    const [result] = await pool.query(
      'UPDATE communities SET name = ?, address = ?, description = ? WHERE id = ?',
      [name, address, description, req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '小区不存在' });
    }

    // 记录日志
    const log = createLogger(req);
    await log(Actions.UPDATE, Modules.COMMUNITY, {
      targetType: 'community',
      targetId: parseInt(req.params.id),
      targetName: name,
      details: `更新小区: ${name}`,
    });

    res.json({ id: parseInt(req.params.id), name, address, description });
  } catch (error) {
    console.error('更新小区错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 删除小区
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    // 获取要删除的小区信息（用于日志）
    const [communities] = await pool.query('SELECT name FROM communities WHERE id = ?', [req.params.id]);
    const deletedCommunity = communities[0];

    const [result] = await pool.query(
      'DELETE FROM communities WHERE id = ?',
      [req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '小区不存在' });
    }

    // 记录日志
    const log = createLogger(req);
    await log(Actions.DELETE, Modules.COMMUNITY, {
      targetType: 'community',
      targetId: parseInt(req.params.id),
      targetName: deletedCommunity?.name,
      details: `删除小区: ${deletedCommunity?.name}`,
    });

    res.json({ message: '删除成功' });
  } catch (error) {
    console.error('删除小区错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// ===== 期数管理 =====

// 获取小区的所有期数
router.get('/:communityId/phases', authMiddleware, async (req, res) => {
  try {
    const [phases] = await pool.query(`
      SELECT p.*,
        (SELECT COUNT(*) FROM owners WHERE phase_id = p.id) as owner_count,
        (SELECT SUM(area) FROM owners WHERE phase_id = p.id) as total_area
      FROM phases p
      WHERE p.community_id = ?
      ORDER BY p.code
    `, [req.params.communityId]);

    res.json(phases);
  } catch (error) {
    console.error('获取期数列表错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 创建期数
router.post('/:communityId/phases', authMiddleware, async (req, res) => {
  try {
    const { name, code, description } = req.body;
    const communityId = req.params.communityId;

    if (!name || !code) {
      return res.status(400).json({ error: '期数名称和代码不能为空' });
    }

    const [result] = await pool.query(
      'INSERT INTO phases (community_id, name, code, description) VALUES (?, ?, ?, ?)',
      [communityId, name, code, description]
    );

    // 记录日志
    const log = createLogger(req);
    await log(Actions.CREATE, Modules.PHASE, {
      targetType: 'phase',
      targetId: result.insertId,
      targetName: name,
      details: `创建期数: ${name} (${code})`,
    });

    res.status(201).json({
      id: result.insertId,
      community_id: parseInt(communityId),
      name,
      code,
      description
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: '该期数代码已存在' });
    }
    console.error('创建期数错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 更新期数
router.put('/phases/:id', authMiddleware, async (req, res) => {
  try {
    const { name, code, description } = req.body;

    const [result] = await pool.query(
      'UPDATE phases SET name = ?, code = ?, description = ? WHERE id = ?',
      [name, code, description, req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '期数不存在' });
    }

    // 记录日志
    const log = createLogger(req);
    await log(Actions.UPDATE, Modules.PHASE, {
      targetType: 'phase',
      targetId: parseInt(req.params.id),
      targetName: name,
      details: `更新期数: ${name} (${code})`,
    });

    res.json({ id: parseInt(req.params.id), name, code, description });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: '该期数代码已存在' });
    }
    console.error('更新期数错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 删除期数
router.delete('/phases/:id', authMiddleware, async (req, res) => {
  try {
    // 获取要删除的期数信息（用于日志）
    const [phases] = await pool.query('SELECT name, code FROM phases WHERE id = ?', [req.params.id]);
    const deletedPhase = phases[0];

    const [result] = await pool.query(
      'DELETE FROM phases WHERE id = ?',
      [req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '期数不存在' });
    }

    // 记录日志
    const log = createLogger(req);
    await log(Actions.DELETE, Modules.PHASE, {
      targetType: 'phase',
      targetId: parseInt(req.params.id),
      targetName: deletedPhase?.name,
      details: `删除期数: ${deletedPhase?.name} (${deletedPhase?.code})`,
    });

    res.json({ message: '删除成功' });
  } catch (error) {
    console.error('删除期数错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
