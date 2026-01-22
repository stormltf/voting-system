/* eslint-disable no-console */
const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const { pool } = require('../models/db');
const {
  authMiddleware,
  adminMiddleware,
  isSuperAdmin,
  canAccessCommunity,
  canManageCommunity
} = require('../middleware/auth');
const { createLogger, Actions, Modules } = require('../utils/logger');

const router = express.Router();

// 辅助函数：通过 phase_id 获取 community_id
async function getCommunityIdByPhase(phaseId) {
  const [phases] = await pool.query('SELECT community_id FROM phases WHERE id = ?', [phaseId]);
  return phases.length > 0 ? phases[0].community_id : null;
}

// 辅助函数：通过 owner_id 获取 community_id
async function getCommunityIdByOwner(ownerId) {
  const [owners] = await pool.query(`
    SELECT p.community_id
    FROM owners o
    JOIN phases p ON o.phase_id = p.id
    WHERE o.id = ?
  `, [ownerId]);
  return owners.length > 0 ? owners[0].community_id : null;
}

// 配置文件上传
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// 获取业主列表（支持分页、搜索、筛选）
router.get('/', authMiddleware, async (req, res) => {
  try {
    const {
      page = 1,
      limit: rawLimit = 3000,
      search,
      phase_id,
      community_id,
      building,
      vote_status,
      round_id,
      wechat_status,
      house_status
    } = req.query;

    const limit = parseInt(rawLimit) || 3000;
    const pageNum = parseInt(page) || 1;
    const offset = (pageNum - 1) * limit;
    let whereConditions = ['1=1'];
    let params = [];
    let joinParams = [];

    // 非超级管理员只能查看自己小区的数据
    if (!isSuperAdmin(req.user)) {
      whereConditions.push('p.community_id = ?');
      params.push(req.user.communityId);
    } else if (community_id) {
      // 超级管理员可以按小区筛选
      whereConditions.push('p.community_id = ?');
      params.push(community_id);
    }

    if (phase_id) {
      whereConditions.push('o.phase_id = ?');
      params.push(phase_id);
    }

    if (building) {
      whereConditions.push('o.building = ?');
      params.push(building);
    }

    if (search) {
      whereConditions.push('(o.owner_name LIKE ? OR o.room_number LIKE ? OR o.phone1 LIKE ? OR o.phone2 LIKE ?)');
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    if (wechat_status) {
      whereConditions.push('o.wechat_status = ?');
      params.push(wechat_status);
    }

    if (house_status) {
      whereConditions.push('o.house_status = ?');
      params.push(house_status);
    }

    const whereClause = whereConditions.join(' AND ');

    // 构建投票状态筛选的 JOIN
    let voteJoin = '';
    let voteSelect = '';
    if (round_id) {
      voteJoin = 'LEFT JOIN votes v ON o.id = v.owner_id AND v.round_id = ?';
      joinParams.push(round_id);
      voteSelect = ', v.vote_status, v.vote_phone, v.vote_date, v.remark as vote_remark, v.sweep_status';
      if (vote_status) {
        if (vote_status === 'pending') {
          whereConditions.push('(v.vote_status IS NULL OR v.vote_status = "pending")');
        } else {
          whereConditions.push('v.vote_status = ?');
          params.push(vote_status);
        }
      }
    }

    // 获取总数
    const [countResult] = await pool.query(`
      SELECT COUNT(*) as total
      FROM owners o
      JOIN phases p ON o.phase_id = p.id
      JOIN communities c ON p.community_id = c.id
      ${voteJoin}
      WHERE ${whereClause}
    `, [...joinParams, ...params]);

    // 获取数据
    const [owners] = await pool.query(`
      SELECT o.*, p.name as phase_name, p.code as phase_code,
             c.name as community_name, c.id as community_id
             ${voteSelect}
      FROM owners o
      JOIN phases p ON o.phase_id = p.id
      JOIN communities c ON p.community_id = c.id
      ${voteJoin}
      WHERE ${whereClause}
      ORDER BY o.phase_id, o.building, o.unit, o.room
      LIMIT ? OFFSET ?
    `, [...joinParams, ...params, limit, offset]);

    res.json({
      data: owners,
      pagination: {
        page: pageNum,
        limit,
        total: countResult[0].total,
        totalPages: Math.ceil(countResult[0].total / limit)
      }
    });
  } catch (error) {
    console.error('获取业主列表错误:', error);
    res.status(500).json({ error: '服务器内部错误，请稍后重试' });
  }
});

// 导出业主数据为 Excel（必须在 /:id 路由之前）
router.get('/export', authMiddleware, async (req, res) => {
  try {
    const { phase_id, community_id, building, search, round_id, vote_status } = req.query;

    let whereConditions = ['1=1'];
    let params = [];
    let joinParams = [];

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

    if (building) {
      whereConditions.push('o.building = ?');
      params.push(building);
    }

    if (search) {
      whereConditions.push('(o.owner_name LIKE ? OR o.room_number LIKE ? OR o.phone1 LIKE ?)');
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    // 构建投票状态筛选的 JOIN
    let voteJoin = '';
    let voteSelect = '';
    if (round_id) {
      voteJoin = 'LEFT JOIN votes v ON o.id = v.owner_id AND v.round_id = ?';
      joinParams.push(round_id);
      voteSelect = `, COALESCE(v.vote_status, 'pending') as vote_status, v.vote_date, v.remark as vote_remark, v.sweep_status`;

      if (vote_status) {
        if (vote_status === 'pending') {
          whereConditions.push('(v.vote_status IS NULL OR v.vote_status = "pending")');
        } else {
          whereConditions.push('v.vote_status = ?');
          params.push(vote_status);
        }
      }
    }

    const whereClause = whereConditions.join(' AND ');

    // 获取数据
    const [owners] = await pool.query(`
      SELECT o.*, p.name as phase_name, c.name as community_name
             ${voteSelect}
      FROM owners o
      JOIN phases p ON o.phase_id = p.id
      JOIN communities c ON p.community_id = c.id
      ${voteJoin}
      WHERE ${whereClause}
      ORDER BY o.phase_id, o.building, o.unit, o.room
    `, [...joinParams, ...params]);

    // 投票状态映射
    const voteStatusMap = {
      'pending': '待投票',
      'voted': '已投票',
      'onsite': '现场投票',
      'video': '视频投票',
      'refused': '拒绝'
    };

    // 转换为 Excel 格式
    const excelData = owners.map((owner, index) => {
      const row = {
        '序号': owner.seq_no || index + 1,
        '小区': owner.community_name,
        '期数': owner.phase_name,
        '房间号': owner.room_number,
        '楼栋': owner.building,
        '单元': owner.unit,
        '房号': owner.room,
        '业主姓名': owner.owner_name,
        '面积': owner.area,
        '车位号': owner.parking_no,
        '车位面积': owner.parking_area,
        '联系电话1': owner.phone1,
        '联系电话2': owner.phone2,
        '联系电话3': owner.phone3,
        '群状态': owner.wechat_status,
        '微信沟通人': owner.wechat_contact,
        '房屋状态': owner.house_status,
      };

      // 如果有投票信息
      if (round_id) {
        row['投票状态'] = voteStatusMap[owner.vote_status] || owner.vote_status;
        row['投票日期'] = owner.vote_date ? new Date(owner.vote_date).toLocaleDateString('zh-CN') : '';
        row['扫楼状态'] = owner.sweep_status || '';
        row['投票备注'] = owner.vote_remark || '';
      }

      return row;
    });

    // 创建工作簿（使用轻量级 xlsx 库）
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);

    // 设置列宽
    ws['!cols'] = [
      { wch: 6 },  // 序号
      { wch: 15 }, // 小区
      { wch: 10 }, // 期数
      { wch: 15 }, // 房间号
      { wch: 8 },  // 楼栋
      { wch: 8 },  // 单元
      { wch: 8 },  // 房号
      { wch: 12 }, // 业主姓名
      { wch: 10 }, // 面积
      { wch: 12 }, // 车位号
      { wch: 10 }, // 车位面积
      { wch: 15 }, // 联系电话1
      { wch: 15 }, // 联系电话2
      { wch: 15 }, // 联系电话3
      { wch: 10 }, // 群状态
      { wch: 12 }, // 微信沟通人
      { wch: 10 }, // 房屋状态
    ];

    if (round_id) {
      ws['!cols'].push(
        { wch: 10 }, // 投票状态
        { wch: 12 }, // 投票日期
        { wch: 15 }, // 扫楼状态
        { wch: 20 }, // 投票备注
      );
    }

    XLSX.utils.book_append_sheet(wb, ws, '业主数据');
    const buffer = Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));

    // 设置响应头
    const filename = encodeURIComponent(`业主数据_${new Date().toISOString().slice(0, 10)}.xlsx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${filename}`);

    res.send(buffer);
  } catch (error) {
    console.error('导出业主数据错误:', error);
    res.status(500).json({ error: '服务器内部错误，请稍后重试' });
  }
});

// 获取楼栋列表（必须在 /:id 路由之前定义）
router.get('/buildings/:phaseId', authMiddleware, async (req, res) => {
  try {
    const phaseId = parseInt(req.params.phaseId);

    // 检查访问权限
    const communityId = await getCommunityIdByPhase(phaseId);
    if (!communityId) {
      return res.status(404).json({ error: '期数不存在' });
    }
    if (!canAccessCommunity(req.user, communityId)) {
      return res.status(403).json({ error: '无权访问该小区数据' });
    }

    const [buildings] = await pool.query(`
      SELECT DISTINCT building
      FROM owners
      WHERE phase_id = ? AND building IS NOT NULL
      ORDER BY building
    `, [phaseId]);

    res.json(buildings.map(b => b.building));
  } catch (error) {
    console.error('获取楼栋列表错误:', error);
    res.status(500).json({ error: '服务器内部错误，请稍后重试' });
  }
});

// 获取单元列表（必须在 /:id 路由之前定义）
router.get('/units/:phaseId/:building', authMiddleware, async (req, res) => {
  try {
    const phaseId = parseInt(req.params.phaseId);

    // 检查访问权限
    const communityId = await getCommunityIdByPhase(phaseId);
    if (!communityId) {
      return res.status(404).json({ error: '期数不存在' });
    }
    if (!canAccessCommunity(req.user, communityId)) {
      return res.status(403).json({ error: '无权访问该小区数据' });
    }

    const [units] = await pool.query(`
      SELECT DISTINCT unit
      FROM owners
      WHERE phase_id = ? AND building = ? AND unit IS NOT NULL
      ORDER BY unit
    `, [phaseId, req.params.building]);

    res.json(units.map(u => u.unit));
  } catch (error) {
    console.error('获取单元列表错误:', error);
    res.status(500).json({ error: '服务器内部错误，请稍后重试' });
  }
});

// 获取单个业主详情
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const ownerId = parseInt(req.params.id);

    const [owners] = await pool.query(`
      SELECT o.*, p.name as phase_name, p.code as phase_code,
             c.name as community_name, c.id as community_id
      FROM owners o
      JOIN phases p ON o.phase_id = p.id
      JOIN communities c ON p.community_id = c.id
      WHERE o.id = ?
    `, [ownerId]);

    if (owners.length === 0) {
      return res.status(404).json({ error: '业主不存在' });
    }

    // 检查访问权限
    if (!canAccessCommunity(req.user, owners[0].community_id)) {
      return res.status(403).json({ error: '无权访问该小区数据' });
    }

    // 获取所有投票记录
    const [votes] = await pool.query(`
      SELECT v.*, r.name as round_name, r.year, r.round_code
      FROM votes v
      JOIN vote_rounds r ON v.round_id = r.id
      WHERE v.owner_id = ?
      ORDER BY r.year DESC, r.round_code DESC
    `, [ownerId]);

    res.json({
      ...owners[0],
      votes
    });
  } catch (error) {
    console.error('获取业主详情错误:', error);
    res.status(500).json({ error: '服务器内部错误，请稍后重试' });
  }
});

// 创建业主（管理员可操作）
router.post('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const {
      phase_id, seq_no, building, unit, room, room_number,
      owner_name, area, parking_no, parking_area,
      phone1, phone2, phone3, wechat_status, wechat_contact, house_status
    } = req.body;

    if (!phase_id || !room_number) {
      return res.status(400).json({ error: '期数和房间号不能为空' });
    }

    // 检查管理权限
    const communityId = await getCommunityIdByPhase(phase_id);
    if (!communityId) {
      return res.status(400).json({ error: '指定的期数不存在' });
    }
    if (!canManageCommunity(req.user, communityId)) {
      return res.status(403).json({ error: '无权管理该小区数据' });
    }

    const [result] = await pool.query(`
      INSERT INTO owners (phase_id, seq_no, building, unit, room, room_number,
        owner_name, area, parking_no, parking_area,
        phone1, phone2, phone3, wechat_status, wechat_contact, house_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [phase_id, seq_no, building, unit, room, room_number,
      owner_name, area, parking_no, parking_area,
      phone1, phone2, phone3, wechat_status, wechat_contact, house_status]);

    // 记录日志
    const log = createLogger(req);
    await log(Actions.CREATE, Modules.OWNER, {
      targetType: 'owner',
      targetId: result.insertId,
      targetName: room_number,
      details: `创建业主: ${room_number} - ${owner_name || ''}`,
    });

    res.status(201).json({ id: result.insertId, ...req.body });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: '该房间号已存在' });
    }
    console.error('创建业主错误:', error);
    res.status(500).json({ error: '服务器内部错误，请稍后重试' });
  }
});

// 更新业主（管理员可操作）
router.put('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const ownerId = parseInt(req.params.id);

    // 检查管理权限
    const communityId = await getCommunityIdByOwner(ownerId);
    if (!communityId) {
      return res.status(404).json({ error: '业主不存在' });
    }
    if (!canManageCommunity(req.user, communityId)) {
      return res.status(403).json({ error: '无权管理该小区数据' });
    }

    // 动态构建更新语句，只更新传递的字段
    const allowedFields = [
      'seq_no', 'building', 'unit', 'room', 'room_number',
      'owner_name', 'area', 'parking_no', 'parking_area',
      'phone1', 'phone2', 'phone3', 'wechat_status', 'wechat_contact', 'house_status'
    ];

    const updates = [];
    const values = [];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(req.body[field]);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: '没有要更新的字段' });
    }

    values.push(ownerId);

    await pool.query(`
      UPDATE owners SET ${updates.join(', ')} WHERE id = ?
    `, values);

    // 获取更新后的业主信息用于日志
    const [updatedOwner] = await pool.query('SELECT room_number, owner_name FROM owners WHERE id = ?', [ownerId]);
    const ownerInfo = updatedOwner[0] || {};

    // 记录日志
    const log = createLogger(req);
    await log(Actions.UPDATE, Modules.OWNER, {
      targetType: 'owner',
      targetId: ownerId,
      targetName: ownerInfo.room_number,
      details: `更新业主: ${ownerInfo.room_number} - ${ownerInfo.owner_name || ''}`,
    });

    res.json({ id: ownerId, ...req.body });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: '该房间号已存在' });
    }
    console.error('更新业主错误:', error);
    res.status(500).json({ error: '服务器内部错误，请稍后重试' });
  }
});

// 删除业主（管理员可操作）
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const ownerId = parseInt(req.params.id);

    // 检查管理权限
    const communityId = await getCommunityIdByOwner(ownerId);
    if (!communityId) {
      return res.status(404).json({ error: '业主不存在' });
    }
    if (!canManageCommunity(req.user, communityId)) {
      return res.status(403).json({ error: '无权管理该小区数据' });
    }

    // 获取要删除的业主信息（用于日志）
    const [owners] = await pool.query('SELECT room_number, owner_name FROM owners WHERE id = ?', [ownerId]);
    const deletedOwner = owners[0];

    await pool.query('DELETE FROM owners WHERE id = ?', [ownerId]);

    // 记录日志
    const log = createLogger(req);
    await log(Actions.DELETE, Modules.OWNER, {
      targetType: 'owner',
      targetId: ownerId,
      targetName: deletedOwner.room_number,
      details: `删除业主: ${deletedOwner.room_number} - ${deletedOwner.owner_name || ''}`,
    });

    res.json({ message: '删除成功' });
  } catch (error) {
    console.error('删除业主错误:', error);
    res.status(500).json({ error: '服务器内部错误，请稍后重试' });
  }
});

// 批量导入业主数据（管理员可操作） - 内存优化版：边读取边处理，分批插入
router.post('/import', authMiddleware, adminMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传文件' });
    }

    // 验证文件类型（出于安全考虑仅支持 .xlsx）
    const fileExtension = req.file.originalname.split('.').pop().toLowerCase();
    if (fileExtension !== 'xlsx') {
      return res.status(400).json({ error: '请上传有效的 Excel 文件 (.xlsx)' });
    }

    const { phase_id } = req.body;
    if (!phase_id) {
      return res.status(400).json({ error: '请指定期数' });
    }

    // 检查管理权限
    const communityId = await getCommunityIdByPhase(phase_id);
    if (!communityId) {
      return res.status(400).json({ error: '指定的期数不存在' });
    }
    if (!canManageCommunity(req.user, communityId)) {
      return res.status(403).json({ error: '无权管理该小区数据' });
    }

    // 解析 Excel 文件（使用轻量级 xlsx 库）
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      return res.status(400).json({ error: '文件中没有数据' });
    }

    // 转换为 JSON 数组（第一行作为表头）
    const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    if (jsonData.length === 0) {
      return res.status(400).json({ error: '文件中没有数据' });
    }

    const headers = Object.keys(jsonData[0]);

    // 列名映射
    const columnMap = {
      '序号': 'seq_no',
      '房间号': 'room_number',
      '姓名': 'owner_name',
      '面积': 'area',
      '车位号': 'parking_no',
      '车位面积': 'parking_area',
      '联系电话1': 'phone1',
      '联系电话2': 'phone2',
      '联系电话3': 'phone3',
      '群状态': 'wechat_status',
      '微信沟通人': 'wechat_contact',
      '房屋状态': 'house_status'
    };

    // 辅助函数：处理单行数据
    const processRow = (rowData, rowIndex) => {
      const owner = {};
      for (const [cnName, enName] of Object.entries(columnMap)) {
        if (rowData[cnName] !== undefined) {
          owner[enName] = rowData[cnName];
        }
      }

      if (!owner.room_number) {
        return { error: `第 ${rowData['序号'] || rowIndex} 行: 缺少房间号` };
      }

      // 解析房间号 (格式: 01-01-0101 -> 楼号-单元-房间)
      const roomParts = String(owner.room_number).split('-');
      let building = null, unit = null, room = null;
      if (roomParts.length >= 3) {
        building = roomParts[0];
        unit = roomParts[1];
        room = roomParts.slice(2).join('-');
      } else {
        room = owner.room_number;
      }

      // 处理面积
      let area = null;
      if (owner.area) {
        area = parseFloat(String(owner.area).replace('+', '')) || null;
      }

      let parking_area = null;
      if (owner.parking_area) {
        parking_area = parseFloat(String(owner.parking_area)) || null;
      }

      return {
        data: [
          phase_id,
          owner.seq_no || null,
          building,
          unit,
          room,
          owner.room_number,
          owner.owner_name || null,
          area,
          owner.parking_no || null,
          parking_area,
          owner.phone1 || null,
          owner.phone2 || null,
          owner.phone3 || null,
          owner.wechat_status || '',
          owner.wechat_contact || null,
          owner.house_status || null
        ]
      };
    };

    // 辅助函数：批量插入数据库，插入后暂停让 GC 有机会运行
    const insertBatch = async (batch) => {
      if (batch.length === 0) return;
      await pool.query(`
        INSERT INTO owners (phase_id, seq_no, building, unit, room, room_number,
          owner_name, area, parking_no, parking_area,
          phone1, phone2, phone3, wechat_status, wechat_contact, house_status)
        VALUES ?
        ON DUPLICATE KEY UPDATE
          seq_no = VALUES(seq_no),
          owner_name = VALUES(owner_name),
          area = VALUES(area),
          parking_no = VALUES(parking_no),
          parking_area = VALUES(parking_area),
          phone1 = VALUES(phone1),
          phone2 = VALUES(phone2),
          phone3 = VALUES(phone3),
          wechat_status = VALUES(wechat_status),
          wechat_contact = VALUES(wechat_contact),
          house_status = VALUES(house_status)
      `, [batch]);
      // 让出 CPU 时间，允许 GC 运行
      await new Promise(resolve => setImmediate(resolve));
    };

    // 内存优化：减小批次大小到 200 条
    const BATCH_SIZE = 200;
    let currentBatch = [];
    const errors = [];
    let successCount = 0;
    let failCount = 0;
    let totalRows = 0;

    // 逐行处理 Excel 数据
    for (let i = 0; i < jsonData.length; i++) {
      const rowData = jsonData[i];
      if (Object.keys(rowData).length === 0) continue;
      totalRows++;

      // 处理当前行
      try {
        const result = processRow(rowData, i + 2);
        if (result.error) {
          failCount++;
          if (errors.length < 10) errors.push(result.error);
        } else {
          currentBatch.push(result.data);
        }
      } catch (err) {
        failCount++;
        if (errors.length < 10) errors.push(`第 ${rowData['序号'] || i + 2} 行: 数据格式错误`);
      }

      // 达到批次大小时，执行插入并清空批次
      if (currentBatch.length >= BATCH_SIZE) {
        await insertBatch(currentBatch);
        successCount += currentBatch.length;
        currentBatch = []; // 清空数组，释放内存
      }
    }

    // 处理剩余的数据
    if (currentBatch.length > 0) {
      await insertBatch(currentBatch);
      successCount += currentBatch.length;
    }

    if (totalRows === 0) {
      return res.status(400).json({ error: '文件中没有数据' });
    }

    // 记录日志
    const log = createLogger(req);
    await log(Actions.IMPORT, Modules.OWNER, {
      targetType: 'owner',
      details: `批量导入业主: 成功 ${successCount} 条, 失败 ${failCount} 条`,
    });

    res.json({
      message: `导入完成: 成功 ${successCount} 条, 失败 ${failCount} 条`,
      successCount,
      failCount,
      errors: errors.slice(0, 10)
    });
  } catch (error) {
    console.error('导入业主数据错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
