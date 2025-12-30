const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const { pool } = require('../models/db');
const { authMiddleware } = require('../middleware/auth');
const { createLogger, Actions, Modules } = require('../utils/logger');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// ===== 投票轮次管理 =====

// 获取所有投票轮次
router.get('/rounds', authMiddleware, async (req, res) => {
  try {
    const { community_id } = req.query;

    let whereClause = '1=1';
    let params = [];

    if (community_id) {
      whereClause += ' AND r.community_id = ?';
      params.push(community_id);
    }

    const [rounds] = await pool.query(`
      SELECT r.*, c.name as community_name,
        (SELECT COUNT(*) FROM votes WHERE round_id = r.id AND vote_status != 'pending') as voted_count,
        (SELECT COUNT(*) FROM votes WHERE round_id = r.id) as total_votes
      FROM vote_rounds r
      LEFT JOIN communities c ON r.community_id = c.id
      WHERE ${whereClause}
      ORDER BY r.year DESC, r.round_code DESC
    `, params);
    res.json(rounds);
  } catch (error) {
    console.error('获取投票轮次错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取单个投票轮次
router.get('/rounds/:id', authMiddleware, async (req, res) => {
  try {
    const [rounds] = await pool.query(`
      SELECT r.*, c.name as community_name
      FROM vote_rounds r
      LEFT JOIN communities c ON r.community_id = c.id
      WHERE r.id = ?
    `, [req.params.id]);

    if (rounds.length === 0) {
      return res.status(404).json({ error: '投票轮次不存在' });
    }

    res.json(rounds[0]);
  } catch (error) {
    console.error('获取投票轮次错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 创建投票轮次
router.post('/rounds', authMiddleware, async (req, res) => {
  try {
    const { community_id, name, year, round_code, start_date, end_date, status, description } = req.body;

    if (!community_id) {
      return res.status(400).json({ error: '请选择小区' });
    }

    if (!name || !year) {
      return res.status(400).json({ error: '投票名称和年份不能为空' });
    }

    const [result] = await pool.query(`
      INSERT INTO vote_rounds (community_id, name, year, round_code, start_date, end_date, status, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [community_id, name, year, round_code, start_date, end_date, status || 'draft', description]);

    // 记录日志
    const log = createLogger(req);
    await log(Actions.CREATE, Modules.VOTE_ROUND, {
      targetType: 'vote_round',
      targetId: result.insertId,
      targetName: name,
      details: `创建投票轮次: ${name} (${year}${round_code || ''})`,
    });

    res.status(201).json({
      id: result.insertId,
      community_id, name, year, round_code, start_date, end_date,
      status: status || 'draft', description
    });
  } catch (error) {
    console.error('创建投票轮次错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 更新投票轮次
router.put('/rounds/:id', authMiddleware, async (req, res) => {
  try {
    const { name, year, round_code, start_date, end_date, status, description } = req.body;

    const [result] = await pool.query(`
      UPDATE vote_rounds SET
        name = ?, year = ?, round_code = ?, start_date = ?,
        end_date = ?, status = ?, description = ?
      WHERE id = ?
    `, [name, year, round_code, start_date, end_date, status, description, req.params.id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '投票轮次不存在' });
    }

    // 记录日志
    const log = createLogger(req);
    await log(Actions.UPDATE, Modules.VOTE_ROUND, {
      targetType: 'vote_round',
      targetId: parseInt(req.params.id),
      targetName: name,
      details: `更新投票轮次: ${name} (状态: ${status})`,
    });

    res.json({ id: parseInt(req.params.id), ...req.body });
  } catch (error) {
    console.error('更新投票轮次错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 删除投票轮次
router.delete('/rounds/:id', authMiddleware, async (req, res) => {
  try {
    // 获取要删除的轮次信息（用于日志）
    const [rounds] = await pool.query('SELECT name, year, round_code FROM vote_rounds WHERE id = ?', [req.params.id]);
    const deletedRound = rounds[0];

    const [result] = await pool.query(
      'DELETE FROM vote_rounds WHERE id = ?',
      [req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '投票轮次不存在' });
    }

    // 记录日志
    const log = createLogger(req);
    await log(Actions.DELETE, Modules.VOTE_ROUND, {
      targetType: 'vote_round',
      targetId: parseInt(req.params.id),
      targetName: deletedRound?.name,
      details: `删除投票轮次: ${deletedRound?.name}`,
    });

    res.json({ message: '删除成功' });
  } catch (error) {
    console.error('删除投票轮次错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// ===== 投票记录管理 =====

// 获取投票记录
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { round_id, phase_id, community_id, vote_status, search, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let whereConditions = ['1=1'];
    let params = [];

    if (round_id) {
      whereConditions.push('v.round_id = ?');
      params.push(round_id);
    }

    if (community_id) {
      whereConditions.push('p.community_id = ?');
      params.push(community_id);
    }

    if (phase_id) {
      whereConditions.push('o.phase_id = ?');
      params.push(phase_id);
    }

    if (vote_status) {
      whereConditions.push('v.vote_status = ?');
      params.push(vote_status);
    }

    if (search) {
      whereConditions.push('(o.room_number LIKE ? OR o.owner_name LIKE ? OR o.phone1 LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const whereClause = whereConditions.join(' AND ');

    const [countResult] = await pool.query(`
      SELECT COUNT(*) as total
      FROM votes v
      JOIN owners o ON v.owner_id = o.id
      JOIN phases p ON o.phase_id = p.id
      WHERE ${whereClause}
    `, params);

    const [votes] = await pool.query(`
      SELECT v.*, o.room_number, o.owner_name, o.building, o.unit,
             o.area, o.parking_no, o.parking_area,
             o.phone1, o.phone2, o.phone3,
             o.wechat_status, o.wechat_contact, o.house_status,
             p.name as phase_name, c.name as community_name,
             r.name as round_name
      FROM votes v
      JOIN owners o ON v.owner_id = o.id
      JOIN phases p ON o.phase_id = p.id
      JOIN communities c ON p.community_id = c.id
      JOIN vote_rounds r ON v.round_id = r.id
      WHERE ${whereClause}
      ORDER BY o.room_number ASC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), parseInt(offset)]);

    res.json({
      data: votes,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult[0].total,
        totalPages: Math.ceil(countResult[0].total / limit)
      }
    });
  } catch (error) {
    console.error('获取投票记录错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 创建或更新投票记录
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { owner_id, round_id, vote_status, vote_phone, vote_date, remark, sweep_status } = req.body;

    if (!owner_id || !round_id) {
      return res.status(400).json({ error: '业主ID和投票轮次不能为空' });
    }

    const [result] = await pool.query(`
      INSERT INTO votes (owner_id, round_id, vote_status, vote_phone, vote_date, remark, sweep_status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        vote_status = VALUES(vote_status),
        vote_phone = VALUES(vote_phone),
        vote_date = VALUES(vote_date),
        remark = VALUES(remark),
        sweep_status = VALUES(sweep_status)
    `, [owner_id, round_id, vote_status || 'pending', vote_phone, vote_date, remark, sweep_status]);

    // 获取业主信息用于日志
    const [owners] = await pool.query('SELECT room_number FROM owners WHERE id = ?', [owner_id]);
    const owner = owners[0];

    // 记录日志
    const log = createLogger(req);
    await log(Actions.UPDATE, Modules.VOTE, {
      targetType: 'vote',
      targetId: owner_id,
      targetName: owner?.room_number,
      details: `更新投票记录: ${owner?.room_number} -> ${vote_status || 'pending'}`,
    });

    res.json({
      id: result.insertId || result.insertId,
      owner_id, round_id, vote_status, vote_phone, vote_date, remark, sweep_status
    });
  } catch (error) {
    console.error('保存投票记录错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 批量更新投票状态
router.put('/batch', authMiddleware, async (req, res) => {
  try {
    const { owner_ids, round_id, vote_status, vote_date } = req.body;

    if (!owner_ids || !Array.isArray(owner_ids) || owner_ids.length === 0) {
      return res.status(400).json({ error: '请选择业主' });
    }

    if (!round_id) {
      return res.status(400).json({ error: '请选择投票轮次' });
    }

    let successCount = 0;
    for (const owner_id of owner_ids) {
      await pool.query(`
        INSERT INTO votes (owner_id, round_id, vote_status, vote_date)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          vote_status = VALUES(vote_status),
          vote_date = VALUES(vote_date)
      `, [owner_id, round_id, vote_status || 'voted', vote_date || new Date()]);
      successCount++;
    }

    // 记录日志
    const log = createLogger(req);
    await log(Actions.BATCH_UPDATE, Modules.VOTE, {
      targetType: 'vote',
      details: `批量更新投票状态: ${successCount} 条记录 -> ${vote_status || 'voted'}`,
    });

    res.json({ message: `成功更新 ${successCount} 条记录` });
  } catch (error) {
    console.error('批量更新投票状态错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// ===== 初始化和导入 =====

// 一键初始化投票记录（为所有业主创建待投票记录）
router.post('/init', authMiddleware, async (req, res) => {
  try {
    const { round_id, community_id } = req.body;

    if (!round_id || !community_id) {
      return res.status(400).json({ error: '请选择投票轮次和小区' });
    }

    // 获取该小区所有业主
    const [owners] = await pool.query(`
      SELECT o.id FROM owners o
      JOIN phases p ON o.phase_id = p.id
      WHERE p.community_id = ?
    `, [community_id]);

    if (owners.length === 0) {
      return res.status(400).json({ error: '该小区没有业主数据' });
    }

    // 批量插入投票记录（忽略已存在的）
    let insertCount = 0;
    for (const owner of owners) {
      const [result] = await pool.query(`
        INSERT IGNORE INTO votes (owner_id, round_id, vote_status)
        VALUES (?, ?, 'pending')
      `, [owner.id, round_id]);
      if (result.affectedRows > 0) {
        insertCount++;
      }
    }

    // 记录日志
    const log = createLogger(req);
    await log(Actions.CREATE, Modules.VOTE, {
      targetType: 'vote',
      details: `初始化投票记录: 轮次ID ${round_id}, 创建 ${insertCount} 条记录`,
    });

    res.json({
      message: `成功初始化 ${insertCount} 条投票记录`,
      total: owners.length,
      created: insertCount,
      skipped: owners.length - insertCount,
    });
  } catch (error) {
    console.error('初始化投票记录错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// Excel 批量导入投票状态
router.post('/import', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    const { round_id, community_id, vote_column } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: '请上传文件' });
    }

    if (!round_id || !community_id) {
      return res.status(400).json({ error: '请选择投票轮次和小区' });
    }

    // 解析 Excel
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    if (data.length < 2) {
      return res.status(400).json({ error: 'Excel 文件为空或格式错误' });
    }

    const headers = data[0];

    // 查找房间号列（支持多种列名）
    const roomColIndex = headers.findIndex(h =>
      h && (h.includes('房间') || h.includes('房号') || h === '房间号')
    );
    if (roomColIndex === -1) {
      return res.status(400).json({ error: '找不到房间号列' });
    }

    // 查找投票状态列（如 "25B投否"）
    let voteColIndex = -1;
    if (vote_column) {
      voteColIndex = headers.findIndex(h => h && h.includes(vote_column));
    }
    if (voteColIndex === -1) {
      // 尝试自动查找包含"投否"的列
      voteColIndex = headers.findIndex(h => h && h.includes('投否'));
    }
    if (voteColIndex === -1) {
      return res.status(400).json({ error: '找不到投票状态列，请指定 vote_column 参数' });
    }

    // 查找备注列
    const remarkColIndex = headers.findIndex(h => h && h.includes('备注'));

    // 查找扫楼情况列
    const sweepColIndex = headers.findIndex(h => h && h.includes('扫楼'));

    // 获取该小区所有业主（用于匹配房间号）
    const [owners] = await pool.query(`
      SELECT o.id, o.room_number FROM owners o
      JOIN phases p ON o.phase_id = p.id
      WHERE p.community_id = ?
    `, [community_id]);

    // 创建房间号到业主ID的映射
    const roomToOwnerId = {};
    for (const owner of owners) {
      // 标准化房间号（去除空格和特殊字符）
      const normalizedRoom = owner.room_number.replace(/[\s-]/g, '');
      roomToOwnerId[normalizedRoom] = owner.id;
      roomToOwnerId[owner.room_number] = owner.id;
    }

    // 处理数据
    let successCount = 0;
    let votedCount = 0;
    let pendingCount = 0;
    let notFoundCount = 0;
    const notFoundRooms = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row || !row[roomColIndex]) continue;

      const roomNumber = String(row[roomColIndex]).trim();
      const voteValue = row[voteColIndex];
      const remark = remarkColIndex >= 0 ? row[remarkColIndex] : null;
      const sweepStatus = sweepColIndex >= 0 ? row[sweepColIndex] : null;

      // 标准化房间号进行匹配
      const normalizedRoom = roomNumber.replace(/[\s-]/g, '');
      const ownerId = roomToOwnerId[normalizedRoom] || roomToOwnerId[roomNumber];

      if (!ownerId) {
        notFoundCount++;
        if (notFoundRooms.length < 10) {
          notFoundRooms.push(roomNumber);
        }
        continue;
      }

      // 判断投票状态：值为 1 表示已投票
      const voteStatus = (voteValue === 1 || voteValue === '1' || voteValue === '是') ? 'voted' : 'pending';

      // 插入或更新投票记录（所有业主都导入，包括未投票的）
      await pool.query(`
        INSERT INTO votes (owner_id, round_id, vote_status, remark, sweep_status)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          vote_status = VALUES(vote_status),
          remark = COALESCE(VALUES(remark), remark),
          sweep_status = COALESCE(VALUES(sweep_status), sweep_status)
      `, [ownerId, round_id, voteStatus, remark || null, sweepStatus || null]);

      successCount++;
      if (voteStatus === 'voted') {
        votedCount++;
      } else {
        pendingCount++;
      }
    }

    // 记录日志
    const log = createLogger(req);
    await log(Actions.IMPORT, Modules.VOTE, {
      targetType: 'vote',
      details: `导入投票记录: 总计 ${successCount} (已投票 ${votedCount}, 待投票 ${pendingCount}), 未找到 ${notFoundCount}`,
    });

    res.json({
      message: `导入完成`,
      success: successCount,
      voted: votedCount,
      pending: pendingCount,
      notFound: notFoundCount,
      notFoundRooms: notFoundRooms,
      voteColumn: headers[voteColIndex],
    });
  } catch (error) {
    console.error('导入投票记录错误:', error);
    res.status(500).json({ error: '服务器错误: ' + error.message });
  }
});

// ===== 统计数据 =====

// 获取投票统计
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const { round_id, community_id, phase_id } = req.query;

    let whereConditions = ['1=1'];
    let params = [];

    if (community_id) {
      whereConditions.push('p.community_id = ?');
      params.push(community_id);
    }

    if (phase_id) {
      whereConditions.push('o.phase_id = ?');
      params.push(phase_id);
    }

    const whereClause = whereConditions.join(' AND ');

    // 总业主数和面积
    const [totalResult] = await pool.query(`
      SELECT
        COUNT(*) as total_owners,
        COALESCE(SUM(o.area), 0) as total_area,
        COALESCE(SUM(o.parking_area), 0) as total_parking_area
      FROM owners o
      JOIN phases p ON o.phase_id = p.id
      WHERE ${whereClause}
    `, params);

    // 如果指定了轮次，获取该轮次的投票统计
    let voteStats = null;
    if (round_id) {
      const [voteResult] = await pool.query(`
        SELECT
          COUNT(CASE WHEN v.vote_status IN ('voted', 'onsite', 'video') THEN 1 END) as voted_count,
          COUNT(CASE WHEN v.vote_status = 'refused' THEN 1 END) as refused_count,
          COUNT(CASE WHEN v.vote_status = 'pending' OR v.vote_status IS NULL THEN 1 END) as pending_count,
          COALESCE(SUM(CASE WHEN v.vote_status IN ('voted', 'onsite', 'video') THEN o.area END), 0) as voted_area,
          COALESCE(SUM(CASE WHEN v.vote_status IN ('voted', 'onsite', 'video') THEN o.parking_area END), 0) as voted_parking_area
        FROM owners o
        JOIN phases p ON o.phase_id = p.id
        LEFT JOIN votes v ON o.id = v.owner_id AND v.round_id = ?
        WHERE ${whereClause}
      `, [round_id, ...params]);

      voteStats = voteResult[0];
    }

    // 按期数统计（包含投票数据）
    const phaseQuery = round_id ? `
      SELECT
        p.id as phase_id,
        p.name as phase_name,
        c.name as community_name,
        COUNT(o.id) as owner_count,
        COALESCE(SUM(o.area), 0) as total_area,
        COALESCE(SUM(o.parking_area), 0) as total_parking_area,
        COUNT(CASE WHEN v.vote_status IN ('voted', 'onsite', 'video') THEN 1 END) as voted_count,
        COALESCE(SUM(CASE WHEN v.vote_status IN ('voted', 'onsite', 'video') THEN o.area END), 0) as voted_area,
        COALESCE(SUM(CASE WHEN v.vote_status IN ('voted', 'onsite', 'video') THEN o.parking_area END), 0) as voted_parking_area
      FROM phases p
      JOIN communities c ON p.community_id = c.id
      LEFT JOIN owners o ON o.phase_id = p.id
      LEFT JOIN votes v ON o.id = v.owner_id AND v.round_id = ?
      WHERE ${community_id ? 'p.community_id = ?' : '1=1'}
      GROUP BY p.id, p.name, c.name
      HAVING COUNT(o.id) > 0
      ORDER BY c.name, p.code
    ` : `
      SELECT
        p.id as phase_id,
        p.name as phase_name,
        c.name as community_name,
        COUNT(o.id) as owner_count,
        COALESCE(SUM(o.area), 0) as total_area,
        COALESCE(SUM(o.parking_area), 0) as total_parking_area,
        0 as voted_count,
        0 as voted_area,
        0 as voted_parking_area
      FROM phases p
      JOIN communities c ON p.community_id = c.id
      LEFT JOIN owners o ON o.phase_id = p.id
      WHERE ${community_id ? 'p.community_id = ?' : '1=1'}
      GROUP BY p.id, p.name, c.name
      HAVING COUNT(o.id) > 0
      ORDER BY c.name, p.code
    `;

    const phaseParams = round_id
      ? (community_id ? [round_id, community_id] : [round_id])
      : (community_id ? [community_id] : []);

    const [phaseStats] = await pool.query(phaseQuery, phaseParams);

    // 按楼栋统计（如果指定了期数或小区）
    let buildingStats = [];
    if (phase_id || community_id) {
      const [buildings] = await pool.query(`
        SELECT
          o.building,
          p.name as phase_name,
          COUNT(*) as owner_count,
          COUNT(CASE WHEN v.vote_status IN ('voted', 'onsite', 'video') THEN 1 END) as voted_count
        FROM owners o
        JOIN phases p ON o.phase_id = p.id
        LEFT JOIN votes v ON o.id = v.owner_id ${round_id ? 'AND v.round_id = ?' : ''}
        WHERE ${whereClause} AND o.building IS NOT NULL
        GROUP BY o.building, p.id
        ORDER BY p.name, o.building
      `, round_id ? [round_id, ...params] : params);

      buildingStats = buildings;
    }

    res.json({
      total: totalResult[0],
      voteStats,
      phaseStats,
      buildingStats
    });
  } catch (error) {
    console.error('获取统计数据错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取投票进度（用于仪表盘）
router.get('/progress', authMiddleware, async (req, res) => {
  try {
    const { community_id } = req.query;

    let roundFilter = '';
    let communityFilter = '';
    let params = [];
    if (community_id) {
      roundFilter = 'WHERE r.community_id = ?';
      communityFilter = 'AND p.community_id = ?';
      params.push(community_id, community_id);
    }

    // 获取该小区所有轮次的投票进度
    const [progress] = await pool.query(`
      SELECT
        r.id as round_id,
        r.name as round_name,
        r.year,
        r.round_code,
        r.status,
        r.community_id,
        COUNT(DISTINCT o.id) as total_owners,
        COUNT(CASE WHEN v.vote_status IN ('voted', 'onsite', 'video') THEN 1 END) as voted_count,
        COALESCE(SUM(o.area), 0) as total_area,
        COALESCE(SUM(o.parking_area), 0) as total_parking_area,
        COALESCE(SUM(CASE WHEN v.vote_status IN ('voted', 'onsite', 'video') THEN o.area END), 0) as voted_area,
        COALESCE(SUM(CASE WHEN v.vote_status IN ('voted', 'onsite', 'video') THEN o.parking_area END), 0) as voted_parking_area
      FROM vote_rounds r
      LEFT JOIN (
        SELECT o.*, p.community_id
        FROM owners o
        JOIN phases p ON o.phase_id = p.id
        WHERE 1=1 ${communityFilter}
      ) o ON r.community_id = o.community_id
      LEFT JOIN votes v ON o.id = v.owner_id AND v.round_id = r.id
      ${roundFilter}
      GROUP BY r.id
      ORDER BY r.year DESC, r.round_code DESC
    `, params);

    res.json(progress);
  } catch (error) {
    console.error('获取投票进度错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
