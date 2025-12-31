const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const { pool } = require('../models/db');
const {
  authMiddleware,
  adminMiddleware,
  ROLES,
  isSuperAdmin,
  canAccessCommunity,
  canManageCommunity
} = require('../middleware/auth');
const { createLogger, Actions, Modules } = require('../utils/logger');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 限制 5MB
});

// 辅助函数：获取投票轮次的小区ID
async function getCommunityIdByRound(roundId) {
  const [rounds] = await pool.query('SELECT community_id FROM vote_rounds WHERE id = ?', [roundId]);
  return rounds.length > 0 ? rounds[0].community_id : null;
}

// ===== 投票轮次管理 =====

// 获取所有投票轮次（超级管理员看所有，其他用户只看自己小区的）
router.get('/rounds', authMiddleware, async (req, res) => {
  try {
    const { community_id } = req.query;

    let whereClause = '1=1';
    let params = [];

    // 非超级管理员只能看到自己小区的投票轮次
    if (!isSuperAdmin(req.user)) {
      whereClause += ' AND r.community_id = ?';
      params.push(req.user.communityId);
    } else if (community_id) {
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
    const roundId = parseInt(req.params.id);

    const [rounds] = await pool.query(`
      SELECT r.*, c.name as community_name
      FROM vote_rounds r
      LEFT JOIN communities c ON r.community_id = c.id
      WHERE r.id = ?
    `, [roundId]);

    if (rounds.length === 0) {
      return res.status(404).json({ error: '投票轮次不存在' });
    }

    // 检查访问权限
    if (!canAccessCommunity(req.user, rounds[0].community_id)) {
      return res.status(403).json({ error: '无权访问该投票轮次' });
    }

    res.json(rounds[0]);
  } catch (error) {
    console.error('获取投票轮次错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 创建投票轮次（管理员可操作）
router.post('/rounds', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { community_id, name, year, round_code, start_date, end_date, status, description } = req.body;

    if (!community_id) {
      return res.status(400).json({ error: '请选择小区' });
    }

    // 检查管理权限
    if (!canManageCommunity(req.user, community_id)) {
      return res.status(403).json({ error: '无权管理该小区' });
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

// 更新投票轮次（管理员可操作）
router.put('/rounds/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const roundId = parseInt(req.params.id);

    // 获取轮次所属小区
    const communityId = await getCommunityIdByRound(roundId);
    if (!communityId) {
      return res.status(404).json({ error: '投票轮次不存在' });
    }

    // 检查管理权限
    if (!canManageCommunity(req.user, communityId)) {
      return res.status(403).json({ error: '无权管理该投票轮次' });
    }

    const { name, year, round_code, start_date, end_date, status, description } = req.body;

    await pool.query(`
      UPDATE vote_rounds SET
        name = ?, year = ?, round_code = ?, start_date = ?,
        end_date = ?, status = ?, description = ?
      WHERE id = ?
    `, [name, year, round_code, start_date, end_date, status, description, roundId]);

    // 记录日志
    const log = createLogger(req);
    await log(Actions.UPDATE, Modules.VOTE_ROUND, {
      targetType: 'vote_round',
      targetId: roundId,
      targetName: name,
      details: `更新投票轮次: ${name} (状态: ${status})`,
    });

    res.json({ id: roundId, ...req.body });
  } catch (error) {
    console.error('更新投票轮次错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 删除投票轮次（管理员可操作）
router.delete('/rounds/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const roundId = parseInt(req.params.id);

    // 获取要删除的轮次信息
    const [rounds] = await pool.query('SELECT name, year, round_code, community_id FROM vote_rounds WHERE id = ?', [roundId]);
    if (rounds.length === 0) {
      return res.status(404).json({ error: '投票轮次不存在' });
    }

    const deletedRound = rounds[0];

    // 检查管理权限
    if (!canManageCommunity(req.user, deletedRound.community_id)) {
      return res.status(403).json({ error: '无权删除该投票轮次' });
    }

    await pool.query('DELETE FROM vote_rounds WHERE id = ?', [roundId]);

    // 记录日志
    const log = createLogger(req);
    await log(Actions.DELETE, Modules.VOTE_ROUND, {
      targetType: 'vote_round',
      targetId: roundId,
      targetName: deletedRound.name,
      details: `删除投票轮次: ${deletedRound.name}`,
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

    // 非超级管理员只能看到自己小区的投票记录
    if (!isSuperAdmin(req.user)) {
      whereConditions.push('p.community_id = ?');
      params.push(req.user.communityId);
    } else if (community_id) {
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

// 创建或更新投票记录（管理员可操作）
router.post('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { owner_id, round_id, vote_status, vote_phone, vote_date, remark, sweep_status } = req.body;

    if (!owner_id || !round_id) {
      return res.status(400).json({ error: '业主ID和投票轮次不能为空' });
    }

    // 获取轮次所属小区并检查权限
    const communityId = await getCommunityIdByRound(round_id);
    if (!communityId) {
      return res.status(400).json({ error: '投票轮次不存在' });
    }
    if (!canManageCommunity(req.user, communityId)) {
      return res.status(403).json({ error: '无权管理该投票轮次' });
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

// 批量更新投票状态（管理员可操作）
router.put('/batch', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { owner_ids, round_id, vote_status, vote_date } = req.body;

    if (!owner_ids || !Array.isArray(owner_ids) || owner_ids.length === 0) {
      return res.status(400).json({ error: '请选择业主' });
    }

    if (!round_id) {
      return res.status(400).json({ error: '请选择投票轮次' });
    }

    // Check permissions
    const communityId = await getCommunityIdByRound(round_id);
    if (!communityId) {
      return res.status(400).json({ error: '投票轮次不存在' });
    }
    if (!canManageCommunity(req.user, communityId)) {
      return res.status(403).json({ error: '无权管理该投票轮次' });
    }

    const targetDate = vote_date || new Date();
    const targetStatus = vote_status || 'voted';

    // Prepare bulk data: [owner_id, round_id, vote_status, vote_date]
    const values = owner_ids.map(id => [id, round_id, targetStatus, targetDate]);

    // Use bulk insert + update syntax
    const [result] = await pool.query(`
      INSERT INTO votes (owner_id, round_id, vote_status, vote_date)
      VALUES ?
      ON DUPLICATE KEY UPDATE
        vote_status = VALUES(vote_status),
        vote_date = VALUES(vote_date)
    `, [values]);

    // Log the action
    const log = createLogger(req);
    await log(Actions.BATCH_UPDATE, Modules.VOTE, {
      targetType: 'vote',
      details: `批量更新投票状态: ${values.length} 条记录 -> ${targetStatus}`,
    });

    res.json({ message: `成功更新 ${values.length} 条记录` });
  } catch (error) {
    console.error('批量更新投票状态错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// ===== 初始化和导入 =====

// 一键初始化投票记录（为所有业主创建待投票记录）（管理员可操作）
router.post('/init', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { round_id, community_id } = req.body;

    if (!round_id || !community_id) {
      return res.status(400).json({ error: '请选择投票轮次和小区' });
    }

    // Check permissions
    if (!canManageCommunity(req.user, community_id)) {
      return res.status(403).json({ error: '无权管理该小区' });
    }

    // Performance optimization: Use INSERT INTO ... SELECT
    // Avoids fetching all owners to app layer and loop-inserting
    const [result] = await pool.query(`
      INSERT IGNORE INTO votes (owner_id, round_id, vote_status)
      SELECT o.id, ?, 'pending'
      FROM owners o
      JOIN phases p ON o.phase_id = p.id
      WHERE p.community_id = ?
    `, [round_id, community_id]);

    const createdCount = result.affectedRows;

    // Get total owners for stats only
    const [countResult] = await pool.query(`
      SELECT COUNT(*) as total FROM owners o
      JOIN phases p ON o.phase_id = p.id
      WHERE p.community_id = ?
    `, [community_id]);

    const totalOwners = countResult[0].total;

    // Log the action
    const log = createLogger(req);
    await log(Actions.CREATE, Modules.VOTE, {
      targetType: 'vote',
      details: `初始化投票记录: 轮次ID ${round_id}, 创建 ${createdCount} 条记录`,
    });

    res.json({
      message: `成功初始化 ${createdCount} 条投票记录`,
      total: totalOwners,
      created: createdCount,
      skipped: totalOwners - createdCount,
    });
  } catch (error) {
    console.error('初始化投票记录错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// Excel 批量导入投票状态（管理员可操作）
router.post('/import', authMiddleware, adminMiddleware, upload.single('file'), async (req, res) => {
  try {
    const { round_id, community_id, vote_column } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: '请上传文件' });
    }

    if (!round_id || !community_id) {
      return res.status(400).json({ error: '请选择投票轮次和小区' });
    }

    // Check permissions
    if (!canManageCommunity(req.user, community_id)) {
      return res.status(403).json({ error: '无权管理该小区' });
    }

    // Parse Excel
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    if (data.length < 2) {
      return res.status(400).json({ error: 'Excel 文件为空或格式错误' });
    }

    const headers = data[0];

    // Find Room Column
    const roomColIndex = headers.findIndex(h =>
      h && (h.includes('房间') || h.includes('房号') || h === '房间号')
    );
    if (roomColIndex === -1) {
      return res.status(400).json({ error: '找不到房间号列' });
    }

    // Find Vote Status Column
    let voteColIndex = -1;
    if (vote_column) {
      voteColIndex = headers.findIndex(h => h && h.includes(vote_column));
    }
    if (voteColIndex === -1) {
      voteColIndex = headers.findIndex(h => h && h.includes('投否'));
    }
    if (voteColIndex === -1) {
      return res.status(400).json({ error: '找不到投票状态列，请指定 vote_column 参数' });
    }

    // Find other columns
    const remarkColIndex = headers.findIndex(h => h && h.includes('备注'));
    const sweepColIndex = headers.findIndex(h => h && h.includes('扫楼'));

    // Get owners map
    const [owners] = await pool.query(`
      SELECT o.id, o.room_number FROM owners o
      JOIN phases p ON o.phase_id = p.id
      WHERE p.community_id = ?
    `, [community_id]);

    const roomToOwnerId = {};
    for (const owner of owners) {
      const normalizedRoom = String(owner.room_number).replace(/[\s-]/g, '');
      roomToOwnerId[normalizedRoom] = owner.id;
      roomToOwnerId[owner.room_number] = owner.id;
    }

    // Pre-process data
    const bulkData = [];
    const notFoundRooms = [];
    let votedCount = 0;
    let pendingCount = 0;
    let notFoundCount = 0;

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row || !row[roomColIndex]) continue;

      const roomNumber = String(row[roomColIndex]).trim();
      const voteValue = row[voteColIndex];
      const remark = remarkColIndex >= 0 ? row[remarkColIndex] : null;
      const sweepStatus = sweepColIndex >= 0 ? row[sweepColIndex] : null;

      const normalizedRoom = roomNumber.replace(/[\s-]/g, '');
      const ownerId = roomToOwnerId[normalizedRoom] || roomToOwnerId[roomNumber];

      if (!ownerId) {
        notFoundCount++;
        if (notFoundRooms.length < 10) {
          notFoundRooms.push(roomNumber);
        }
        continue;
      }

      const voteStatus = (voteValue === 1 || voteValue === '1' || voteValue === '是') ? 'voted' : 'pending';
      if (voteStatus === 'voted') votedCount++; else pendingCount++;

      // [ownerId, roundId, voteStatus, remark, sweepStatus]
      bulkData.push([
        ownerId,
        round_id,
        voteStatus,
        remark || null,
        sweepStatus || null
      ]);
    }

    // Bulk Insert / Update in batches
    if (bulkData.length > 0) {
      const BATCH_SIZE = 1000;
      for (let i = 0; i < bulkData.length; i += BATCH_SIZE) {
        const batch = bulkData.slice(i, i + BATCH_SIZE);

        await pool.query(`
          INSERT INTO votes (owner_id, round_id, vote_status, remark, sweep_status)
          VALUES ?
          ON DUPLICATE KEY UPDATE
            vote_status = VALUES(vote_status),
            remark = COALESCE(VALUES(remark), remark),
            sweep_status = COALESCE(VALUES(sweep_status), sweep_status)
        `, [batch]);
      }
    }

    // Log the action
    const log = createLogger(req);
    await log(Actions.IMPORT, Modules.VOTE, {
      targetType: 'vote',
      details: `导入投票记录: 总计 ${bulkData.length} (已投票 ${votedCount}, 待投票 ${pendingCount}), 未找到 ${notFoundCount}`,
    });

    res.json({
      message: `导入完成`,
      success: bulkData.length,
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

// ===== 导出功能 =====

// 导出投票记录为 Excel
router.get('/export', authMiddleware, async (req, res) => {
  try {
    const { round_id, community_id, phase_id, vote_status, search } = req.query;

    if (!round_id) {
      return res.status(400).json({ error: '请指定投票轮次' });
    }

    let whereConditions = ['1=1'];
    let params = [];

    // 非超级管理员只能导出自己小区的数据
    if (!isSuperAdmin(req.user)) {
      whereConditions.push('p.community_id = ?');
      params.push(req.user.communityId);
    } else if (community_id) {
      whereConditions.push('p.community_id = ?');
      params.push(community_id);
    }

    if (phase_id) {
      whereConditions.push('o.phase_id = ?');
      params.push(phase_id);
    }

    if (vote_status) {
      if (vote_status === 'pending') {
        whereConditions.push('(v.vote_status IS NULL OR v.vote_status = "pending")');
      } else {
        whereConditions.push('v.vote_status = ?');
        params.push(vote_status);
      }
    }

    if (search) {
      whereConditions.push('(o.owner_name LIKE ? OR o.room_number LIKE ? OR o.phone1 LIKE ?)');
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    const whereClause = whereConditions.join(' AND ');

    // 获取投票数据
    const [records] = await pool.query(`
      SELECT
        o.seq_no,
        o.room_number,
        o.building,
        o.unit,
        o.room,
        o.owner_name,
        o.area,
        o.parking_no,
        o.parking_area,
        o.phone1,
        o.phone2,
        o.phone3,
        o.wechat_status,
        o.wechat_contact,
        p.name as phase_name,
        c.name as community_name,
        r.name as round_name,
        COALESCE(v.vote_status, 'pending') as vote_status,
        v.vote_phone,
        v.vote_date,
        v.remark,
        v.sweep_status
      FROM owners o
      JOIN phases p ON o.phase_id = p.id
      JOIN communities c ON p.community_id = c.id
      LEFT JOIN votes v ON o.id = v.owner_id AND v.round_id = ?
      LEFT JOIN vote_rounds r ON r.id = ?
      WHERE ${whereClause}
      ORDER BY p.name, o.building, o.unit, o.room
    `, [round_id, round_id, ...params]);

    // 投票状态映射
    const voteStatusMap = {
      'pending': '待投票',
      'voted': '已投票',
      'onsite': '现场投票',
      'video': '视频投票',
      'refused': '拒绝',
      'sweep': '扫楼中'
    };

    // 转换为 Excel 格式
    const excelData = records.map((record, index) => ({
      '序号': record.seq_no || index + 1,
      '小区': record.community_name,
      '期数': record.phase_name,
      '房间号': record.room_number,
      '楼栋': record.building,
      '单元': record.unit,
      '房号': record.room,
      '业主姓名': record.owner_name,
      '面积': record.area,
      '车位号': record.parking_no,
      '车位面积': record.parking_area,
      '联系电话1': record.phone1,
      '联系电话2': record.phone2,
      '联系电话3': record.phone3,
      '投票状态': voteStatusMap[record.vote_status] || record.vote_status,
      '投票电话': record.vote_phone || '',
      '投票日期': record.vote_date ? new Date(record.vote_date).toLocaleDateString('zh-CN') : '',
      '扫楼状态': record.sweep_status || '',
      '备注': record.remark || '',
    }));

    // 创建工作簿
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);

    // 设置列宽
    ws['!cols'] = [
      { wch: 6 },   // 序号
      { wch: 15 },  // 小区
      { wch: 10 },  // 期数
      { wch: 15 },  // 房间号
      { wch: 8 },   // 楼栋
      { wch: 8 },   // 单元
      { wch: 8 },   // 房号
      { wch: 12 },  // 业主姓名
      { wch: 10 },  // 面积
      { wch: 12 },  // 车位号
      { wch: 10 },  // 车位面积
      { wch: 15 },  // 联系电话1
      { wch: 15 },  // 联系电话2
      { wch: 15 },  // 联系电话3
      { wch: 10 },  // 投票状态
      { wch: 15 },  // 投票电话
      { wch: 12 },  // 投票日期
      { wch: 15 },  // 扫楼状态
      { wch: 25 },  // 备注
    ];

    // 获取轮次名称用于文件名
    const roundName = records[0]?.round_name || '投票';
    XLSX.utils.book_append_sheet(wb, ws, '投票记录');

    // 生成 buffer
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // 设置响应头
    const filename = encodeURIComponent(`${roundName}_投票记录_${new Date().toISOString().slice(0, 10)}.xlsx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${filename}`);

    res.send(buffer);
  } catch (error) {
    console.error('导出投票记录错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// ===== 楼栋可视化 =====

// 获取某单元的详细房间投票数据（用于楼层图可视化）
router.get('/unit-rooms', authMiddleware, async (req, res) => {
  try {
    const { round_id, phase_id, building, unit } = req.query;

    if (!round_id || !phase_id || !building || !unit) {
      return res.status(400).json({ error: '缺少必要参数: round_id, phase_id, building, unit' });
    }

    // 查询该单元所有业主及其投票状态
    const [rooms] = await pool.query(`
      SELECT
        o.id as owner_id,
        o.room_number,
        o.room,
        o.owner_name,
        o.phone1,
        o.area,
        o.parking_no,
        COALESCE(v.vote_status, 'pending') as vote_status,
        v.vote_date,
        v.remark,
        v.sweep_status,
        p.name as phase_name,
        r.name as round_name
      FROM owners o
      JOIN phases p ON o.phase_id = p.id
      LEFT JOIN votes v ON o.id = v.owner_id AND v.round_id = ?
      LEFT JOIN vote_rounds r ON r.id = ?
      WHERE o.phase_id = ? AND o.building = ? AND o.unit = ?
      ORDER BY o.room ASC
    `, [round_id, round_id, phase_id, building, unit]);

    if (rooms.length === 0) {
      return res.json({
        meta: {
          phase_name: '',
          building,
          unit,
          round_name: '',
          total_rooms: 0,
          voted_count: 0,
          refused_count: 0,
          pending_count: 0
        },
        floors: {},
        stats: { max_floor: 0, max_rooms_per_floor: 0 }
      });
    }

    // 解析楼层信息并分组
    const floors = {};
    let maxFloor = 0;
    let maxRoomsPerFloor = 0;

    const stats = { voted: 0, refused: 0, pending: 0 };

    for (const room of rooms) {
      // 从 room 字段解析楼层 (通常最后两位是房号，前面是楼层)
      const roomStr = String(room.room || '');
      let floor = 0;
      let roomInFloor = roomStr;

      // 如果长度大于2，通常采用 XYY 或 XXYY 格式
      if (roomStr.length > 2) {
        const floorPart = roomStr.slice(0, -2);
        if (!isNaN(floorPart)) {
          floor = parseInt(floorPart, 10);
          roomInFloor = roomStr.slice(-2);
        }
      } else {
        // 长度不足，尝试直接解析
        floor = parseInt(roomStr, 10) || 0;
      }

      maxFloor = Math.max(maxFloor, floor);

      if (!floors[floor]) {
        floors[floor] = [];
      }

      floors[floor].push({
        owner_id: room.owner_id,
        room_number: room.room_number,
        floor,
        room_in_floor: roomInFloor,
        owner_name: room.owner_name,
        phone1: room.phone1,
        area: room.area,
        parking_no: room.parking_no,
        vote_status: room.vote_status,
        vote_date: room.vote_date,
        remark: room.remark,
        sweep_status: room.sweep_status
      });

      maxRoomsPerFloor = Math.max(maxRoomsPerFloor, floors[floor].length);

      // 统计
      if (['voted', 'onsite', 'video'].includes(room.vote_status)) {
        stats.voted++;
      } else if (room.vote_status === 'refused') {
        stats.refused++;
      } else {
        stats.pending++;
      }
    }

    res.json({
      meta: {
        phase_name: rooms[0]?.phase_name || '',
        building,
        unit,
        round_name: rooms[0]?.round_name || '',
        total_rooms: rooms.length,
        voted_count: stats.voted,
        refused_count: stats.refused,
        pending_count: stats.pending
      },
      floors,
      stats: {
        max_floor: maxFloor,
        max_rooms_per_floor: maxRoomsPerFloor
      }
    });
  } catch (error) {
    console.error('获取单元房间数据错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取楼栋投票概览（按期数、楼栋、单元汇总统计）
router.get('/building-overview', authMiddleware, async (req, res) => {
  try {
    const { round_id, community_id } = req.query;

    if (!community_id) {
      return res.status(400).json({ error: '缺少必要参数: community_id' });
    }

    // 确定使用的投票轮次（如果未指定，使用最近的活跃轮次或最新轮次）
    let effectiveRoundId = round_id;
    if (!effectiveRoundId) {
      const [latestRound] = await pool.query(`
        SELECT id FROM vote_rounds
        WHERE community_id = ?
        ORDER BY status = 'active' DESC, created_at DESC
        LIMIT 1
      `, [community_id]);

      if (latestRound.length === 0) {
        return res.json({ round: null, phases: [] });
      }
      effectiveRoundId = latestRound[0].id;
    }

    // 获取轮次信息
    const [roundInfo] = await pool.query(`
      SELECT id, name, status, year, round_code FROM vote_rounds WHERE id = ?
    `, [effectiveRoundId]);

    if (roundInfo.length === 0) {
      return res.json({ round: null, phases: [] });
    }

    // 获取该小区所有期数的楼栋单元统计
    const [stats] = await pool.query(`
      SELECT
        p.id as phase_id,
        p.name as phase_name,
        o.building,
        o.unit,
        COUNT(*) as total_rooms,
        COUNT(CASE WHEN v.vote_status IN ('voted', 'onsite', 'video') THEN 1 END) as voted_count,
        COUNT(CASE WHEN v.vote_status = 'refused' THEN 1 END) as refused_count,
        COUNT(CASE WHEN COALESCE(v.vote_status, 'pending') = 'pending' THEN 1 END) as pending_count
      FROM owners o
      JOIN phases p ON o.phase_id = p.id
      LEFT JOIN votes v ON o.id = v.owner_id AND v.round_id = ?
      WHERE p.community_id = ?
      GROUP BY p.id, p.name, o.building, o.unit
      ORDER BY p.name, CAST(o.building AS UNSIGNED), CAST(o.unit AS UNSIGNED)
    `, [effectiveRoundId, community_id]);

    // 按期数分组组织数据
    const phasesMap = new Map();

    for (const row of stats) {
      if (!phasesMap.has(row.phase_id)) {
        phasesMap.set(row.phase_id, {
          phase_id: row.phase_id,
          phase_name: row.phase_name,
          buildings: new Map(),
          total_rooms: 0,
          voted_count: 0,
          refused_count: 0,
          pending_count: 0
        });
      }

      const phase = phasesMap.get(row.phase_id);
      phase.total_rooms += row.total_rooms;
      phase.voted_count += row.voted_count;
      phase.refused_count += row.refused_count;
      phase.pending_count += row.pending_count;

      if (!phase.buildings.has(row.building)) {
        phase.buildings.set(row.building, {
          building: row.building,
          units: [],
          total_rooms: 0,
          voted_count: 0,
          refused_count: 0,
          pending_count: 0
        });
      }

      const building = phase.buildings.get(row.building);
      building.total_rooms += row.total_rooms;
      building.voted_count += row.voted_count;
      building.refused_count += row.refused_count;
      building.pending_count += row.pending_count;

      building.units.push({
        unit: row.unit,
        total_rooms: row.total_rooms,
        voted_count: row.voted_count,
        refused_count: row.refused_count,
        pending_count: row.pending_count
      });
    }

    // 转换为数组格式
    const phases = Array.from(phasesMap.values()).map(phase => ({
      ...phase,
      buildings: Array.from(phase.buildings.values())
    }));

    res.json({
      round: roundInfo[0],
      phases
    });
  } catch (error) {
    console.error('获取楼栋概览数据错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// ===== 扫楼状态管理 =====

// 获取扫楼状态概览（按期数、楼栋、单元汇总统计）- 基于轮次
router.get('/sweep-overview', authMiddleware, async (req, res) => {
  try {
    const { community_id, round_id } = req.query;

    if (!community_id) {
      return res.status(400).json({ error: '缺少必要参数: community_id' });
    }

    // 检查访问权限
    if (!canAccessCommunity(req.user, parseInt(community_id))) {
      return res.status(403).json({ error: '无权访问该小区' });
    }

    // 确定使用的投票轮次
    let effectiveRoundId = round_id;
    if (!effectiveRoundId) {
      const [latestRound] = await pool.query(`
        SELECT id FROM vote_rounds
        WHERE community_id = ?
        ORDER BY status = 'active' DESC, created_at DESC
        LIMIT 1
      `, [community_id]);

      if (latestRound.length === 0) {
        return res.json({ round: null, phases: [] });
      }
      effectiveRoundId = latestRound[0].id;
    }

    // 获取轮次信息
    const [roundInfo] = await pool.query(`
      SELECT id, name, status, year, round_code FROM vote_rounds WHERE id = ?
    `, [effectiveRoundId]);

    if (roundInfo.length === 0) {
      return res.json({ round: null, phases: [] });
    }

    // 获取该小区所有期数的楼栋单元扫楼统计（基于votes表的sweep_status）
    const [stats] = await pool.query(`
      SELECT
        p.id as phase_id,
        p.name as phase_name,
        o.building,
        o.unit,
        COUNT(*) as total_rooms,
        COUNT(CASE WHEN v.sweep_status = 'completed' THEN 1 END) as completed_count,
        COUNT(CASE WHEN v.sweep_status = 'in_progress' THEN 1 END) as in_progress_count,
        COUNT(CASE WHEN v.sweep_status IS NULL OR v.sweep_status = '' OR v.sweep_status = 'pending' THEN 1 END) as pending_count
      FROM owners o
      JOIN phases p ON o.phase_id = p.id
      LEFT JOIN votes v ON o.id = v.owner_id AND v.round_id = ?
      WHERE p.community_id = ?
      GROUP BY p.id, p.name, o.building, o.unit
      ORDER BY p.name, CAST(o.building AS UNSIGNED), CAST(o.unit AS UNSIGNED)
    `, [effectiveRoundId, community_id]);

    // 按期数分组组织数据
    const phasesMap = new Map();

    for (const row of stats) {
      if (!phasesMap.has(row.phase_id)) {
        phasesMap.set(row.phase_id, {
          phase_id: row.phase_id,
          phase_name: row.phase_name,
          buildings: new Map(),
          total_rooms: 0,
          completed_count: 0,
          in_progress_count: 0,
          pending_count: 0
        });
      }

      const phase = phasesMap.get(row.phase_id);
      phase.total_rooms += row.total_rooms;
      phase.completed_count += row.completed_count;
      phase.in_progress_count += row.in_progress_count;
      phase.pending_count += row.pending_count;

      if (!phase.buildings.has(row.building)) {
        phase.buildings.set(row.building, {
          building: row.building,
          units: [],
          total_rooms: 0,
          completed_count: 0,
          in_progress_count: 0,
          pending_count: 0
        });
      }

      const building = phase.buildings.get(row.building);
      building.total_rooms += row.total_rooms;
      building.completed_count += row.completed_count;
      building.in_progress_count += row.in_progress_count;
      building.pending_count += row.pending_count;

      building.units.push({
        unit: row.unit,
        total_rooms: row.total_rooms,
        completed_count: row.completed_count,
        in_progress_count: row.in_progress_count,
        pending_count: row.pending_count
      });
    }

    // 转换为数组格式
    const phases = Array.from(phasesMap.values()).map(phase => ({
      ...phase,
      buildings: Array.from(phase.buildings.values())
    }));

    res.json({ round: roundInfo[0], phases });
  } catch (error) {
    console.error('获取扫楼概览数据错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取某单元的详细扫楼状态数据 - 基于轮次
router.get('/sweep-unit-rooms', authMiddleware, async (req, res) => {
  try {
    const { round_id, phase_id, building, unit } = req.query;

    if (!round_id || !phase_id || !building || !unit) {
      return res.status(400).json({ error: '缺少必要参数: round_id, phase_id, building, unit' });
    }

    // 查询该单元所有业主及其扫楼状态（从votes表获取）
    const [rooms] = await pool.query(`
      SELECT
        o.id as owner_id,
        o.room_number,
        o.room,
        o.owner_name,
        o.phone1,
        o.area,
        o.parking_no,
        COALESCE(v.sweep_status, 'pending') as sweep_status,
        v.remark as sweep_remark,
        v.updated_at as sweep_date,
        v.vote_status,
        p.name as phase_name,
        r.name as round_name
      FROM owners o
      JOIN phases p ON o.phase_id = p.id
      LEFT JOIN votes v ON o.id = v.owner_id AND v.round_id = ?
      LEFT JOIN vote_rounds r ON r.id = ?
      WHERE o.phase_id = ? AND o.building = ? AND o.unit = ?
      ORDER BY o.room ASC
    `, [round_id, round_id, phase_id, building, unit]);

    if (rooms.length === 0) {
      return res.json({
        meta: {
          phase_name: '',
          building,
          unit,
          round_name: '',
          total_rooms: 0,
          completed_count: 0,
          in_progress_count: 0,
          pending_count: 0
        },
        floors: {},
        stats: { max_floor: 0, max_rooms_per_floor: 0 }
      });
    }

    // 解析楼层信息并分组
    const floors = {};
    let maxFloor = 0;
    let maxRoomsPerFloor = 0;

    const stats = { completed: 0, in_progress: 0, pending: 0 };

    for (const room of rooms) {
      const roomStr = String(room.room || '');
      let floor = 0;
      let roomInFloor = roomStr;

      if (roomStr.length > 2) {
        const floorPart = roomStr.slice(0, -2);
        if (!isNaN(floorPart)) {
          floor = parseInt(floorPart, 10);
          roomInFloor = roomStr.slice(-2);
        }
      } else {
        floor = parseInt(roomStr, 10) || 0;
      }

      maxFloor = Math.max(maxFloor, floor);

      if (!floors[floor]) {
        floors[floor] = [];
      }

      floors[floor].push({
        owner_id: room.owner_id,
        room_number: room.room_number,
        floor,
        room_in_floor: roomInFloor,
        owner_name: room.owner_name,
        phone1: room.phone1,
        area: room.area,
        parking_no: room.parking_no,
        sweep_status: room.sweep_status,
        sweep_remark: room.sweep_remark,
        sweep_date: room.sweep_date,
        vote_status: room.vote_status
      });

      maxRoomsPerFloor = Math.max(maxRoomsPerFloor, floors[floor].length);

      // 统计
      if (room.sweep_status === 'completed') {
        stats.completed++;
      } else if (room.sweep_status === 'in_progress') {
        stats.in_progress++;
      } else {
        stats.pending++;
      }
    }

    res.json({
      meta: {
        phase_name: rooms[0]?.phase_name || '',
        building,
        unit,
        round_name: rooms[0]?.round_name || '',
        total_rooms: rooms.length,
        completed_count: stats.completed,
        in_progress_count: stats.in_progress,
        pending_count: stats.pending
      },
      floors,
      stats: {
        max_floor: maxFloor,
        max_rooms_per_floor: maxRoomsPerFloor
      }
    });
  } catch (error) {
    console.error('获取单元扫楼数据错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 更新扫楼状态（管理员可操作）- 更新votes表
router.put('/sweep/:ownerId', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { ownerId } = req.params;
    const { round_id, sweep_status, sweep_remark } = req.body;

    if (!round_id) {
      return res.status(400).json({ error: '请指定投票轮次' });
    }

    // 获取业主所属小区
    const [owners] = await pool.query(`
      SELECT o.room_number, p.community_id
      FROM owners o
      JOIN phases p ON o.phase_id = p.id
      WHERE o.id = ?
    `, [ownerId]);

    if (owners.length === 0) {
      return res.status(404).json({ error: '业主不存在' });
    }

    const owner = owners[0];

    // 检查管理权限
    if (!canManageCommunity(req.user, owner.community_id)) {
      return res.status(403).json({ error: '无权管理该小区' });
    }

    // 更新votes表的sweep_status（如果记录不存在则创建）
    await pool.query(`
      INSERT INTO votes (owner_id, round_id, sweep_status, remark)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        sweep_status = VALUES(sweep_status),
        remark = COALESCE(VALUES(remark), remark)
    `, [ownerId, round_id, sweep_status, sweep_remark]);

    // 记录日志
    const log = createLogger(req);
    await log(Actions.UPDATE, Modules.VOTE, {
      targetType: 'sweep',
      targetId: parseInt(ownerId),
      targetName: owner.room_number,
      details: `更新扫楼状态: ${owner.room_number} -> ${sweep_status}`,
    });

    res.json({ message: '更新成功', sweep_status, sweep_remark });
  } catch (error) {
    console.error('更新扫楼状态错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 批量更新扫楼状态（管理员可操作）- 更新votes表
router.put('/sweep-batch', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { owner_ids, round_id, sweep_status, community_id } = req.body;

    if (!owner_ids || !Array.isArray(owner_ids) || owner_ids.length === 0) {
      return res.status(400).json({ error: '请选择业主' });
    }

    if (!round_id) {
      return res.status(400).json({ error: '请选择投票轮次' });
    }

    if (!sweep_status) {
      return res.status(400).json({ error: '请选择扫楼状态' });
    }

    // 检查管理权限
    if (!canManageCommunity(req.user, community_id)) {
      return res.status(403).json({ error: '无权管理该小区' });
    }

    // 批量更新votes表
    const values = owner_ids.map(id => [id, round_id, sweep_status]);
    await pool.query(`
      INSERT INTO votes (owner_id, round_id, sweep_status)
      VALUES ?
      ON DUPLICATE KEY UPDATE
        sweep_status = VALUES(sweep_status)
    `, [values]);

    // 记录日志
    const log = createLogger(req);
    await log(Actions.BATCH_UPDATE, Modules.VOTE, {
      targetType: 'sweep',
      details: `批量更新扫楼状态: ${owner_ids.length} 条记录 -> ${sweep_status}`,
    });

    res.json({ message: `成功更新 ${owner_ids.length} 条记录` });
  } catch (error) {
    console.error('批量更新扫楼状态错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// ===== 统计数据 =====

// 获取投票统计
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const { round_id, community_id, phase_id } = req.query;

    let whereConditions = ['1=1'];
    let params = [];

    // 非超级管理员只能看自己小区的统计
    if (!isSuperAdmin(req.user)) {
      whereConditions.push('p.community_id = ?');
      params.push(req.user.communityId);
    } else if (community_id) {
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

    // 非超级管理员只能看自己小区的进度
    if (!isSuperAdmin(req.user)) {
      roundFilter = 'WHERE r.community_id = ?';
      communityFilter = 'AND p.community_id = ?';
      params.push(req.user.communityId, req.user.communityId);
    } else if (community_id) {
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
