/* eslint-disable no-console */
const express = require('express');
const { pool } = require('../models/db');
const {
  authMiddleware,
  adminMiddleware,
  canAccessCommunity,
  canManageCommunity
} = require('../middleware/auth');
const { createLogger, Actions, Modules } = require('../utils/logger');
const { validateIdParam, validateRequiredFields } = require('../utils/validators');

const router = express.Router();

// ===== 系统可用字段定义 =====
const AVAILABLE_FIELDS = [
  { key: 'owner_name', label: '业主姓名', source: 'owner' },
  { key: 'building', label: '楼栋号', source: 'owner' },
  { key: 'unit', label: '单元号', source: 'owner' },
  { key: 'room', label: '房号', source: 'owner' },
  { key: 'room_number', label: '完整房号', source: 'owner' },
  { key: 'area', label: '房屋面积', source: 'owner' },
  { key: 'vote_status', label: '投票状态', source: 'vote' },
  { key: 'round_name', label: '投票轮次名称', source: 'round' },
  { key: 'end_date', label: '投票截止时间', source: 'round' }
];

// 获取可用字段列表
router.get('/available-fields', authMiddleware, (req, res) => {
  res.json(AVAILABLE_FIELDS);
});

// ===== 短信配置 API =====

// 获取小区的短信配置
router.get('/config/:communityId', authMiddleware, adminMiddleware, validateIdParam('communityId'), async (req, res) => {
  try {
    const communityId = parseInt(req.params.communityId);

    if (!canAccessCommunity(req.user, communityId)) {
      return res.status(403).json({ error: '无权访问该小区' });
    }

    const [configs] = await pool.query(
      'SELECT id, community_id, access_key_id, enabled, created_at, updated_at FROM sms_configs WHERE community_id = ?',
      [communityId]
    );

    if (configs.length === 0) {
      return res.json(null);
    }

    // 不返回完整的 secret，只返回部分掩码
    const config = configs[0];
    res.json(config);
  } catch (error) {
    console.error('获取短信配置错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 创建或更新短信配置
router.post('/config', authMiddleware, adminMiddleware, validateRequiredFields(['community_id', 'access_key_id', 'access_key_secret']), async (req, res) => {
  try {
    const { community_id, access_key_id, access_key_secret, enabled = true } = req.body;

    if (!canManageCommunity(req.user, community_id)) {
      return res.status(403).json({ error: '无权管理该小区' });
    }

    // 使用 UPSERT 语法
    const [result] = await pool.query(`
      INSERT INTO sms_configs (community_id, access_key_id, access_key_secret, enabled)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        access_key_id = VALUES(access_key_id),
        access_key_secret = VALUES(access_key_secret),
        enabled = VALUES(enabled),
        updated_at = CURRENT_TIMESTAMP
    `, [community_id, access_key_id, access_key_secret, enabled ? 1 : 0]);

    // 记录日志
    const log = createLogger(req);
    await log(Actions.UPDATE, Modules.SMS, {
      targetType: 'sms_config',
      targetId: community_id,
      details: '更新短信配置',
    });

    res.json({
      success: true,
      message: result.affectedRows > 0 ? '配置保存成功' : '配置已更新'
    });
  } catch (error) {
    console.error('保存短信配置错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// ===== 短信模板 API =====

// 获取小区的模板列表
router.get('/templates', authMiddleware, async (req, res) => {
  try {
    const communityId = parseInt(req.query.community_id);

    if (!communityId) {
      return res.status(400).json({ error: '缺少小区ID参数' });
    }

    if (!canAccessCommunity(req.user, communityId)) {
      return res.status(403).json({ error: '无权访问该小区' });
    }

    const [templates] = await pool.query(
      'SELECT * FROM sms_templates WHERE community_id = ? ORDER BY created_at DESC',
      [communityId]
    );

    res.json(templates);
  } catch (error) {
    console.error('获取模板列表错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 获取单个模板详情
router.get('/templates/:id', authMiddleware, validateIdParam('id'), async (req, res) => {
  try {
    const templateId = parseInt(req.params.id);

    const [templates] = await pool.query(
      'SELECT * FROM sms_templates WHERE id = ?',
      [templateId]
    );

    if (templates.length === 0) {
      return res.status(404).json({ error: '模板不存在' });
    }

    const template = templates[0];

    if (!canAccessCommunity(req.user, template.community_id)) {
      return res.status(403).json({ error: '无权访问该模板' });
    }

    res.json(template);
  } catch (error) {
    console.error('获取模板详情错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 创建模板
router.post('/templates', authMiddleware, adminMiddleware, validateRequiredFields(['community_id', 'name', 'template_code', 'sign_name']), async (req, res) => {
  try {
    const { community_id, name, template_code, sign_name, content_preview, variable_mapping } = req.body;

    if (!canManageCommunity(req.user, community_id)) {
      return res.status(403).json({ error: '无权管理该小区' });
    }

    const [result] = await pool.query(
      'INSERT INTO sms_templates (community_id, name, template_code, sign_name, content_preview, variable_mapping) VALUES (?, ?, ?, ?, ?, ?)',
      [community_id, name, template_code, sign_name, content_preview, JSON.stringify(variable_mapping || {})]
    );

    // 记录日志
    const log = createLogger(req);
    await log(Actions.CREATE, Modules.SMS, {
      targetType: 'sms_template',
      targetId: result.insertId,
      targetName: name,
      details: `创建短信模板: ${name}`,
    });

    res.status(201).json({
      id: result.insertId,
      community_id,
      name,
      template_code,
      sign_name,
      content_preview,
      variable_mapping
    });
  } catch (error) {
    console.error('创建模板错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 更新模板
router.put('/templates/:id', authMiddleware, adminMiddleware, validateIdParam('id'), async (req, res) => {
  try {
    const templateId = parseInt(req.params.id);
    const { name, template_code, sign_name, content_preview, variable_mapping } = req.body;

    // 获取模板所属小区
    const [templates] = await pool.query('SELECT community_id FROM sms_templates WHERE id = ?', [templateId]);
    if (templates.length === 0) {
      return res.status(404).json({ error: '模板不存在' });
    }

    if (!canManageCommunity(req.user, templates[0].community_id)) {
      return res.status(403).json({ error: '无权管理该模板' });
    }

    await pool.query(
      'UPDATE sms_templates SET name = ?, template_code = ?, sign_name = ?, content_preview = ?, variable_mapping = ? WHERE id = ?',
      [name, template_code, sign_name, content_preview, JSON.stringify(variable_mapping || {}), templateId]
    );

    // 记录日志
    const log = createLogger(req);
    await log(Actions.UPDATE, Modules.SMS, {
      targetType: 'sms_template',
      targetId: templateId,
      targetName: name,
      details: `更新短信模板: ${name}`,
    });

    res.json({ id: templateId, name, template_code, sign_name, content_preview, variable_mapping });
  } catch (error) {
    console.error('更新模板错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 删除模板
router.delete('/templates/:id', authMiddleware, adminMiddleware, validateIdParam('id'), async (req, res) => {
  try {
    const templateId = parseInt(req.params.id);

    // 获取模板信息
    const [templates] = await pool.query('SELECT name, community_id FROM sms_templates WHERE id = ?', [templateId]);
    if (templates.length === 0) {
      return res.status(404).json({ error: '模板不存在' });
    }

    if (!canManageCommunity(req.user, templates[0].community_id)) {
      return res.status(403).json({ error: '无权管理该模板' });
    }

    await pool.query('DELETE FROM sms_templates WHERE id = ?', [templateId]);

    // 记录日志
    const log = createLogger(req);
    await log(Actions.DELETE, Modules.SMS, {
      targetType: 'sms_template',
      targetId: templateId,
      targetName: templates[0].name,
      details: `删除短信模板: ${templates[0].name}`,
    });

    res.json({ message: '删除成功' });
  } catch (error) {
    console.error('删除模板错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// ===== 发送短信 API =====

// 从字符串中提取手机号（支持手机号后面带备注文字的情况，如 "18610709365李"）
function extractPhoneNumber(phone) {
  if (!phone) return null;
  // 清理空格和横线
  const cleaned = phone.replace(/[\s-]/g, '');
  // 尝试从字符串中提取中国大陆手机号：11位数字，1开头
  const match = cleaned.match(/1[3-9]\d{9}/);
  return match ? match[0] : null;
}

// 手机号格式验证
function isValidPhone(phone) {
  return extractPhoneNumber(phone) !== null;
}

// 获取业主的有效手机号（取第一个非空且格式正确的）
function getValidPhone(owner) {
  const phones = [owner.phone1, owner.phone2, owner.phone3];
  for (const phone of phones) {
    const extracted = extractPhoneNumber(phone);
    if (extracted) {
      return extracted;
    }
  }
  return null;
}

// 投票状态映射
const VOTE_STATUS_MAP = {
  'pending': '未投票',
  'voted': '已投票',
  'refused': '拒绝投票',
  'onsite': '现场投票',
  'video': '视频投票'
};

// 构建期数+楼栋的筛选条件
// target_selections 格式: [{ phase_id: 1, buildings: ['01', '02'] }, { phase_id: 2, buildings: ['01'] }]
function buildPhaseAndBuildingFilter(targetSelections) {
  if (!targetSelections || targetSelections.length === 0) {
    return { sql: '', params: [] };
  }

  const conditions = [];
  const params = [];

  for (const selection of targetSelections) {
    if (selection.buildings && selection.buildings.length > 0) {
      const placeholders = selection.buildings.map(() => '?').join(',');
      conditions.push(`(o.phase_id = ? AND o.building IN (${placeholders}))`);
      params.push(selection.phase_id, ...selection.buildings);
    }
  }

  if (conditions.length === 0) {
    return { sql: '', params: [] };
  }

  return {
    sql: ` AND (${conditions.join(' OR ')})`,
    params
  };
}

// 预览发送（返回接收人信息）
router.post('/preview', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { community_id, task_type, round_id, target_selections, target_filter } = req.body;

    if (!canManageCommunity(req.user, community_id)) {
      return res.status(403).json({ error: '无权管理该小区' });
    }

    let query = '';
    const params = [];

    if (task_type === 'vote_notice') {
      // 投票通知：根据投票轮次筛选
      if (!round_id) {
        return res.status(400).json({ error: '投票通知需要选择投票轮次' });
      }

      query = `
        SELECT o.id, o.owner_name, o.phone1, o.phone2, o.phone3, o.building, o.unit, o.room, o.room_number, o.area,
               o.phase_id, p.name as phase_name,
               v.vote_status, vr.name as round_name, vr.end_date
        FROM owners o
        JOIN phases p ON o.phase_id = p.id
        LEFT JOIN votes v ON o.id = v.owner_id AND v.round_id = ?
        LEFT JOIN vote_rounds vr ON v.round_id = vr.id
        WHERE p.community_id = ?
      `;
      params.push(round_id, community_id);

      // 筛选未投票的业主
      if (target_filter === 'not_voted') {
        query += ` AND (v.vote_status IS NULL OR v.vote_status = 'pending')`;
      }
    } else {
      // 社区公告：按楼栋筛选
      query = `
        SELECT o.id, o.owner_name, o.phone1, o.phone2, o.phone3, o.building, o.unit, o.room, o.room_number, o.area,
               o.phase_id, p.name as phase_name
        FROM owners o
        JOIN phases p ON o.phase_id = p.id
        WHERE p.community_id = ?
      `;
      params.push(community_id);
    }

    // 按期数+楼栋筛选
    const filter = buildPhaseAndBuildingFilter(target_selections);
    query += filter.sql;
    params.push(...filter.params);

    query += ' ORDER BY o.phase_id, o.building, o.unit, o.room';

    const [owners] = await pool.query(query, params);

    // 统计
    let totalCount = owners.length;
    let noPhoneCount = 0;
    let validCount = 0;

    const recipients = owners.map(owner => {
      const phone = getValidPhone(owner);
      if (!phone) {
        noPhoneCount++;
      } else {
        validCount++;
      }
      return {
        id: owner.id,
        owner_name: owner.owner_name,
        phase_name: owner.phase_name,
        room_number: owner.room_number,
        phone: phone,
        has_valid_phone: !!phone,
        vote_status: owner.vote_status ? VOTE_STATUS_MAP[owner.vote_status] || owner.vote_status : null
      };
    });

    res.json({
      total_count: totalCount,
      valid_count: validCount,
      no_phone_count: noPhoneCount,
      recipients: recipients
    });
  } catch (error) {
    console.error('预览发送错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 获取小区楼栋列表（按期数分组，用于选择目标楼栋）
router.get('/buildings/:communityId', authMiddleware, validateIdParam('communityId'), async (req, res) => {
  try {
    const communityId = parseInt(req.params.communityId);

    if (!canAccessCommunity(req.user, communityId)) {
      return res.status(403).json({ error: '无权访问该小区' });
    }

    // 获取期数和楼栋信息
    const [results] = await pool.query(`
      SELECT p.id as phase_id, p.name as phase_name, o.building,
             COUNT(o.id) as owner_count
      FROM owners o
      JOIN phases p ON o.phase_id = p.id
      WHERE p.community_id = ? AND o.building IS NOT NULL AND o.building != ''
      GROUP BY p.id, p.name, o.building
      ORDER BY p.id, o.building
    `, [communityId]);

    // 按期数分组
    const phaseMap = new Map();
    for (const row of results) {
      if (!phaseMap.has(row.phase_id)) {
        phaseMap.set(row.phase_id, {
          phase_id: row.phase_id,
          phase_name: row.phase_name,
          buildings: []
        });
      }
      phaseMap.get(row.phase_id).buildings.push({
        building: row.building,
        owner_count: row.owner_count
      });
    }

    res.json(Array.from(phaseMap.values()));
  } catch (error) {
    console.error('获取楼栋列表错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 发送短信（创建发送任务）
router.post('/send', authMiddleware, adminMiddleware, validateRequiredFields(['community_id', 'template_id', 'task_type']), async (req, res) => {
  try {
    const { community_id, template_id, task_type, round_id, target_selections, target_filter = 'all' } = req.body;

    if (!canManageCommunity(req.user, community_id)) {
      return res.status(403).json({ error: '无权管理该小区' });
    }

    // 验证模板存在
    const [templates] = await pool.query('SELECT * FROM sms_templates WHERE id = ? AND community_id = ?', [template_id, community_id]);
    if (templates.length === 0) {
      return res.status(400).json({ error: '模板不存在或不属于该小区' });
    }

    // 验证短信配置存在
    const [configs] = await pool.query('SELECT * FROM sms_configs WHERE community_id = ? AND enabled = 1', [community_id]);
    if (configs.length === 0) {
      return res.status(400).json({ error: '该小区尚未配置短信服务或已禁用' });
    }

    // 投票通知需要 round_id
    if (task_type === 'vote_notice' && !round_id) {
      return res.status(400).json({ error: '投票通知需要选择投票轮次' });
    }

    // 创建发送任务
    const [taskResult] = await pool.query(`
      INSERT INTO sms_tasks (community_id, template_id, task_type, round_id, target_buildings, target_filter, status, operator_id, operator_name)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)
    `, [
      community_id,
      template_id,
      task_type,
      round_id || null,
      JSON.stringify(target_selections || []),
      target_filter,
      req.user.id,
      req.user.username
    ]);

    const taskId = taskResult.insertId;

    // 记录日志
    const log = createLogger(req);
    await log(Actions.CREATE, Modules.SMS, {
      targetType: 'sms_task',
      targetId: taskId,
      details: `创建短信发送任务: ${task_type === 'vote_notice' ? '投票通知' : '社区公告'}`,
    });

    // 异步执行发送任务
    processSmsTask(taskId).catch(err => {
      console.error('处理短信任务错误:', err);
    });

    res.status(201).json({
      task_id: taskId,
      message: '发送任务已创建，正在后台处理'
    });
  } catch (error) {
    console.error('创建发送任务错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 异步处理短信发送任务
async function processSmsTask(taskId) {
  const connection = await pool.getConnection();

  try {
    // 获取任务信息
    const [tasks] = await connection.query('SELECT * FROM sms_tasks WHERE id = ?', [taskId]);
    if (tasks.length === 0) {
      throw new Error('任务不存在');
    }

    const task = tasks[0];

    // 更新任务状态为处理中
    await connection.query('UPDATE sms_tasks SET status = "processing" WHERE id = ?', [taskId]);

    // 获取短信配置
    const [configs] = await connection.query('SELECT * FROM sms_configs WHERE community_id = ?', [task.community_id]);
    if (configs.length === 0) {
      throw new Error('短信配置不存在');
    }
    const config = configs[0];

    // 获取模板信息
    const [templates] = await connection.query('SELECT * FROM sms_templates WHERE id = ?', [task.template_id]);
    if (templates.length === 0) {
      throw new Error('模板不存在');
    }
    const template = templates[0];
    const variableMapping = typeof template.variable_mapping === 'string'
      ? JSON.parse(template.variable_mapping)
      : template.variable_mapping || {};

    // 获取目标业主列表
    let query = '';
    const params = [];
    const targetSelections = typeof task.target_buildings === 'string'
      ? JSON.parse(task.target_buildings)
      : task.target_buildings || [];

    if (task.task_type === 'vote_notice') {
      query = `
        SELECT o.*, v.vote_status, vr.name as round_name, vr.end_date
        FROM owners o
        JOIN phases p ON o.phase_id = p.id
        LEFT JOIN votes v ON o.id = v.owner_id AND v.round_id = ?
        LEFT JOIN vote_rounds vr ON v.round_id = vr.id
        WHERE p.community_id = ?
      `;
      params.push(task.round_id, task.community_id);

      if (task.target_filter === 'not_voted') {
        query += ` AND (v.vote_status IS NULL OR v.vote_status = 'pending')`;
      }
    } else {
      query = `
        SELECT o.*
        FROM owners o
        JOIN phases p ON o.phase_id = p.id
        WHERE p.community_id = ?
      `;
      params.push(task.community_id);
    }

    // 按期数+楼栋筛选
    const filter = buildPhaseAndBuildingFilter(targetSelections);
    query += filter.sql;
    params.push(...filter.params);

    const [owners] = await connection.query(query, params);

    // 统计
    let totalCount = owners.length;
    let successCount = 0;
    let failCount = 0;
    let noPhoneCount = 0;

    // 初始化阿里云短信客户端
    const smsClient = await createSmsClient(config.access_key_id, config.access_key_secret);

    // 分批发送（每批50条，间隔1秒）
    const BATCH_SIZE = 50;
    const BATCH_DELAY = 1000;

    for (let i = 0; i < owners.length; i += BATCH_SIZE) {
      const batch = owners.slice(i, i + BATCH_SIZE);

      for (const owner of batch) {
        const phone = getValidPhone(owner);

        if (!phone) {
          noPhoneCount++;
          // 记录无手机号的日志
          await connection.query(`
            INSERT INTO sms_logs (task_id, owner_id, owner_name, phone, status, error_message, created_at)
            VALUES (?, ?, ?, '', 'failed', '无有效手机号', NOW())
          `, [taskId, owner.id, owner.owner_name]);
          continue;
        }

        // 构建模板参数
        const templateParams = buildTemplateParams(owner, variableMapping);

        try {
          // 发送短信
          const result = await sendSms(smsClient, {
            phone,
            signName: template.sign_name,
            templateCode: template.template_code,
            templateParams
          });

          if (result.success) {
            successCount++;
            await connection.query(`
              INSERT INTO sms_logs (task_id, owner_id, owner_name, phone, template_params, status, aliyun_request_id, aliyun_biz_id, sent_at, created_at)
              VALUES (?, ?, ?, ?, ?, 'success', ?, ?, NOW(), NOW())
            `, [taskId, owner.id, owner.owner_name, phone, JSON.stringify(templateParams), result.requestId, result.bizId]);
          } else {
            failCount++;
            await connection.query(`
              INSERT INTO sms_logs (task_id, owner_id, owner_name, phone, template_params, status, error_code, error_message, created_at)
              VALUES (?, ?, ?, ?, ?, 'failed', ?, ?, NOW())
            `, [taskId, owner.id, owner.owner_name, phone, JSON.stringify(templateParams), result.errorCode, result.errorMessage]);
          }
        } catch (sendError) {
          failCount++;
          await connection.query(`
            INSERT INTO sms_logs (task_id, owner_id, owner_name, phone, template_params, status, error_message, created_at)
            VALUES (?, ?, ?, ?, ?, 'failed', ?, NOW())
          `, [taskId, owner.id, owner.owner_name, phone, JSON.stringify(templateParams), sendError.message]);
        }
      }

      // 批次间延迟
      if (i + BATCH_SIZE < owners.length) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
      }
    }

    // 更新任务完成状态
    await connection.query(`
      UPDATE sms_tasks SET
        status = 'completed',
        total_count = ?,
        success_count = ?,
        fail_count = ?,
        no_phone_count = ?,
        updated_at = NOW()
      WHERE id = ?
    `, [totalCount, successCount, failCount, noPhoneCount, taskId]);

  } catch (error) {
    console.error('处理短信任务错误:', error);
    // 更新任务失败状态
    await connection.query(`
      UPDATE sms_tasks SET status = 'failed', error_message = ?, updated_at = NOW() WHERE id = ?
    `, [error.message, taskId]);
  } finally {
    connection.release();
  }
}

// 构建模板参数
function buildTemplateParams(owner, variableMapping) {
  const params = {};

  for (const [templateVar, fieldKey] of Object.entries(variableMapping)) {
    let value = '';

    switch (fieldKey) {
      case 'owner_name':
        value = owner.owner_name || '';
        break;
      case 'building':
        value = owner.building || '';
        break;
      case 'unit':
        value = owner.unit || '';
        break;
      case 'room':
        value = owner.room || '';
        break;
      case 'room_number':
        value = owner.room_number || '';
        break;
      case 'area':
        value = owner.area ? String(owner.area) : '';
        break;
      case 'vote_status':
        value = VOTE_STATUS_MAP[owner.vote_status] || '未知';
        break;
      case 'round_name':
        value = owner.round_name || '';
        break;
      case 'end_date':
        value = owner.end_date ? formatDate(owner.end_date) : '';
        break;
      default:
        value = '';
    }

    params[templateVar] = value;
  }

  return params;
}

// 格式化日期
function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// 创建阿里云短信客户端
async function createSmsClient(accessKeyId, accessKeySecret) {
  try {
    const Dysmsapi = require('@alicloud/dysmsapi20170525');
    const OpenApi = require('@alicloud/openapi-client');

    const config = new OpenApi.Config({
      accessKeyId,
      accessKeySecret,
      endpoint: 'dysmsapi.aliyuncs.com'
    });

    return new Dysmsapi.default(config);
  } catch (error) {
    console.error('创建阿里云短信客户端失败:', error);
    throw new Error('短信服务初始化失败，请检查依赖是否安装');
  }
}

// 发送短信
async function sendSms(client, options) {
  const { phone, signName, templateCode, templateParams } = options;

  try {
    const Dysmsapi = require('@alicloud/dysmsapi20170525');

    const request = new Dysmsapi.SendSmsRequest({
      phoneNumbers: phone,
      signName: signName,
      templateCode: templateCode,
      templateParam: JSON.stringify(templateParams)
    });

    const response = await client.sendSms(request);

    if (response.body.code === 'OK') {
      return {
        success: true,
        requestId: response.body.requestId,
        bizId: response.body.bizId
      };
    } else {
      return {
        success: false,
        errorCode: response.body.code,
        errorMessage: response.body.message
      };
    }
  } catch (error) {
    return {
      success: false,
      errorCode: 'SDK_ERROR',
      errorMessage: error.message
    };
  }
}

// ===== 发送记录查询 API =====

// 获取发送任务列表
router.get('/tasks', authMiddleware, async (req, res) => {
  try {
    const { community_id, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    if (!community_id) {
      return res.status(400).json({ error: '缺少小区ID参数' });
    }

    if (!canAccessCommunity(req.user, parseInt(community_id))) {
      return res.status(403).json({ error: '无权访问该小区' });
    }

    // 获取总数
    const [countResult] = await pool.query(
      'SELECT COUNT(*) as total FROM sms_tasks WHERE community_id = ?',
      [community_id]
    );

    // 获取任务列表
    const [tasks] = await pool.query(`
      SELECT t.*,
             tpl.name as template_name,
             vr.name as round_name
      FROM sms_tasks t
      LEFT JOIN sms_templates tpl ON t.template_id = tpl.id
      LEFT JOIN vote_rounds vr ON t.round_id = vr.id
      WHERE t.community_id = ?
      ORDER BY t.created_at DESC
      LIMIT ? OFFSET ?
    `, [community_id, parseInt(limit), offset]);

    res.json({
      tasks,
      pagination: {
        total: countResult[0].total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(countResult[0].total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('获取发送任务列表错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 获取任务详情
router.get('/tasks/:id', authMiddleware, validateIdParam('id'), async (req, res) => {
  try {
    const taskId = parseInt(req.params.id);

    const [tasks] = await pool.query(`
      SELECT t.*,
             tpl.name as template_name, tpl.content_preview,
             vr.name as round_name
      FROM sms_tasks t
      LEFT JOIN sms_templates tpl ON t.template_id = tpl.id
      LEFT JOIN vote_rounds vr ON t.round_id = vr.id
      WHERE t.id = ?
    `, [taskId]);

    if (tasks.length === 0) {
      return res.status(404).json({ error: '任务不存在' });
    }

    const task = tasks[0];

    if (!canAccessCommunity(req.user, task.community_id)) {
      return res.status(403).json({ error: '无权访问该任务' });
    }

    res.json(task);
  } catch (error) {
    console.error('获取任务详情错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 获取任务的发送日志
router.get('/tasks/:id/logs', authMiddleware, validateIdParam('id'), async (req, res) => {
  try {
    const taskId = parseInt(req.params.id);
    const { page = 1, limit = 50, status } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // 验证任务存在并检查权限
    const [tasks] = await pool.query('SELECT community_id FROM sms_tasks WHERE id = ?', [taskId]);
    if (tasks.length === 0) {
      return res.status(404).json({ error: '任务不存在' });
    }

    if (!canAccessCommunity(req.user, tasks[0].community_id)) {
      return res.status(403).json({ error: '无权访问该任务' });
    }

    // 构建查询
    let countQuery = 'SELECT COUNT(*) as total FROM sms_logs WHERE task_id = ?';
    let logsQuery = 'SELECT * FROM sms_logs WHERE task_id = ?';
    const params = [taskId];

    if (status) {
      countQuery += ' AND status = ?';
      logsQuery += ' AND status = ?';
      params.push(status);
    }

    logsQuery += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';

    // 获取总数
    const [countResult] = await pool.query(countQuery, params);

    // 获取日志列表
    const [logs] = await pool.query(logsQuery, [...params, parseInt(limit), offset]);

    res.json({
      logs,
      pagination: {
        total: countResult[0].total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(countResult[0].total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('获取发送日志错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

module.exports = router;
