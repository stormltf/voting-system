const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const { pool } = require('../models/db');
const { authMiddleware } = require('../middleware/auth');
const { createLogger, Actions, Modules } = require('../utils/logger');

const router = express.Router();

// 配置文件上传
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 限制 5MB
});

// 获取业主列表（支持分页、搜索、筛选）
router.get('/', authMiddleware, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      phase_id,
      community_id,
      building,
      vote_status,
      round_id,
      wechat_status,
      house_status
    } = req.query;

    const offset = (page - 1) * limit;
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
      voteJoin = `LEFT JOIN votes v ON o.id = v.owner_id AND v.round_id = ${parseInt(round_id)}`;
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
    `, params);

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
    `, [...params, parseInt(limit), parseInt(offset)]);

    res.json({
      data: owners,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult[0].total,
        totalPages: Math.ceil(countResult[0].total / limit)
      }
    });
  } catch (error) {
    console.error('获取业主列表错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取单个业主详情
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const [owners] = await pool.query(`
      SELECT o.*, p.name as phase_name, p.code as phase_code,
             c.name as community_name, c.id as community_id
      FROM owners o
      JOIN phases p ON o.phase_id = p.id
      JOIN communities c ON p.community_id = c.id
      WHERE o.id = ?
    `, [req.params.id]);

    if (owners.length === 0) {
      return res.status(404).json({ error: '业主不存在' });
    }

    // 获取所有投票记录
    const [votes] = await pool.query(`
      SELECT v.*, r.name as round_name, r.year, r.round_code
      FROM votes v
      JOIN vote_rounds r ON v.round_id = r.id
      WHERE v.owner_id = ?
      ORDER BY r.year DESC, r.round_code DESC
    `, [req.params.id]);

    res.json({
      ...owners[0],
      votes
    });
  } catch (error) {
    console.error('获取业主详情错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 创建业主
router.post('/', authMiddleware, async (req, res) => {
  try {
    const {
      phase_id, seq_no, building, unit, room, room_number,
      owner_name, area, parking_no, parking_area,
      phone1, phone2, phone3, wechat_status, wechat_contact, house_status
    } = req.body;

    if (!phase_id || !room_number) {
      return res.status(400).json({ error: '期数和房间号不能为空' });
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
    res.status(500).json({ error: '服务器错误' });
  }
});

// 更新业主
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const {
      seq_no, building, unit, room, room_number,
      owner_name, area, parking_no, parking_area,
      phone1, phone2, phone3, wechat_status, wechat_contact, house_status
    } = req.body;

    const [result] = await pool.query(`
      UPDATE owners SET
        seq_no = ?, building = ?, unit = ?, room = ?, room_number = ?,
        owner_name = ?, area = ?, parking_no = ?, parking_area = ?,
        phone1 = ?, phone2 = ?, phone3 = ?, wechat_status = ?,
        wechat_contact = ?, house_status = ?
      WHERE id = ?
    `, [seq_no, building, unit, room, room_number,
      owner_name, area, parking_no, parking_area,
      phone1, phone2, phone3, wechat_status, wechat_contact, house_status,
      req.params.id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '业主不存在' });
    }

    // 记录日志
    const log = createLogger(req);
    await log(Actions.UPDATE, Modules.OWNER, {
      targetType: 'owner',
      targetId: parseInt(req.params.id),
      targetName: room_number,
      details: `更新业主: ${room_number} - ${owner_name || ''}`,
    });

    res.json({ id: parseInt(req.params.id), ...req.body });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: '该房间号已存在' });
    }
    console.error('更新业主错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 删除业主
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    // 获取要删除的业主信息（用于日志）
    const [owners] = await pool.query('SELECT room_number, owner_name FROM owners WHERE id = ?', [req.params.id]);
    const deletedOwner = owners[0];

    const [result] = await pool.query(
      'DELETE FROM owners WHERE id = ?',
      [req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '业主不存在' });
    }

    // 记录日志
    const log = createLogger(req);
    await log(Actions.DELETE, Modules.OWNER, {
      targetType: 'owner',
      targetId: parseInt(req.params.id),
      targetName: deletedOwner?.room_number,
      details: `删除业主: ${deletedOwner?.room_number} - ${deletedOwner?.owner_name || ''}`,
    });

    res.json({ message: '删除成功' });
  } catch (error) {
    console.error('删除业主错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 批量导入业主数据
router.post('/import', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传文件' });
    }

    const { phase_id } = req.body;
    if (!phase_id) {
      return res.status(400).json({ error: '请指定期数' });
    }

    // 解析 Excel 文件
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);

    if (data.length === 0) {
      return res.status(400).json({ error: '文件中没有数据' });
    }

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

    let successCount = 0;
    let failCount = 0;
    const errors = [];

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      for (const row of data) {
        try {
          // 映射列名
          const owner = {};
          for (const [cnName, enName] of Object.entries(columnMap)) {
            if (row[cnName] !== undefined) {
              owner[enName] = row[cnName];
            }
          }

          if (!owner.room_number) {
            failCount++;
            errors.push(`第 ${row['序号'] || '?'} 行: 缺少房间号`);
            continue;
          }

          // 解析房间号 (格式: 01-01-0101 -> 楼号-单元-房间)
          const roomParts = String(owner.room_number).split('-');
          if (roomParts.length >= 3) {
            owner.building = roomParts[0];
            owner.unit = roomParts[1];
            owner.room = roomParts.slice(2).join('-');
          }

          // 处理面积 (去掉 + 号)
          if (owner.area) {
            owner.area = parseFloat(String(owner.area).replace('+', '')) || null;
          }

          // 插入或更新
          await connection.query(`
            INSERT INTO owners (phase_id, seq_no, building, unit, room, room_number,
              owner_name, area, parking_no, parking_area,
              phone1, phone2, phone3, wechat_status, wechat_contact, house_status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          `, [
            phase_id,
            owner.seq_no,
            owner.building,
            owner.unit,
            owner.room,
            owner.room_number,
            owner.owner_name,
            owner.area,
            owner.parking_no,
            owner.parking_area ? parseFloat(owner.parking_area) : null,
            owner.phone1,
            owner.phone2,
            owner.phone3,
            owner.wechat_status,
            owner.wechat_contact,
            owner.house_status
          ]);

          successCount++;
        } catch (err) {
          failCount++;
          errors.push(`第 ${row['序号'] || '?'} 行: ${err.message}`);
        }
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
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
      errors: errors.slice(0, 10) // 只返回前10个错误
    });
  } catch (error) {
    console.error('导入业主数据错误:', error);
    res.status(500).json({ error: '服务器错误: ' + error.message });
  }
});

// 获取楼栋列表
router.get('/buildings/:phaseId', authMiddleware, async (req, res) => {
  try {
    const [buildings] = await pool.query(`
      SELECT DISTINCT building
      FROM owners
      WHERE phase_id = ? AND building IS NOT NULL
      ORDER BY building
    `, [req.params.phaseId]);

    res.json(buildings.map(b => b.building));
  } catch (error) {
    console.error('获取楼栋列表错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
