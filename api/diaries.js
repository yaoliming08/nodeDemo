// 日记相关接口
const express = require('express');
const router = express.Router();
const pool = require('./db');

// 获取当前用户的所有日记（按日期倒序）
router.get('/diaries', async (req, res) => {
  // 检查是否已登录
  if (!req.session || !req.session.isAuthenticated) {
    return res.status(401).json({ error: '未登录，请先登录' });
  }

  const userId = req.session.userId;
  const { page = 1, limit = 20, date } = req.query;

  try {
    let sql = 'SELECT * FROM `diaries` WHERE `user_id` = ?';
    const params = [userId];

    // 如果指定了日期，按日期筛选
    if (date) {
      sql += ' AND `diary_date` = ?';
      params.push(date);
    }

    sql += ' ORDER BY `diary_date` DESC, `created_at` DESC';

    // 分页
    const offset = (parseInt(page) - 1) * parseInt(limit);
    sql += ' LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const [rows] = await pool.query(sql, params);

    // 获取总数
    let countSql = 'SELECT COUNT(*) as total FROM `diaries` WHERE `user_id` = ?';
    const countParams = [userId];
    if (date) {
      countSql += ' AND `diary_date` = ?';
      countParams.push(date);
    }
    const [countResult] = await pool.query(countSql, countParams);
    const total = countResult[0].total;

    res.json({
      success: true,
      data: rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    console.error('DB error:', err);
    res.status(500).json({ error: 'Database error', detail: err.message });
  }
});

// 获取日记统计信息（按月份）
router.get('/diaries/stats', async (req, res) => {
  if (!req.session || !req.session.isAuthenticated) {
    return res.status(401).json({ error: '未登录，请先登录' });
  }

  const userId = req.session.userId;

  try {
    // 按月份统计日记数量
    const sql = `
      SELECT 
        DATE_FORMAT(\`diary_date\`, '%Y-%m') as month,
        COUNT(*) as count
      FROM \`diaries\`
      WHERE \`user_id\` = ?
      GROUP BY DATE_FORMAT(\`diary_date\`, '%Y-%m')
      ORDER BY month DESC
    `;
    const [rows] = await pool.query(sql, [userId]);

    res.json({
      success: true,
      data: rows
    });
  } catch (err) {
    console.error('DB error:', err);
    res.status(500).json({ error: 'Database error', detail: err.message });
  }
});

// 获取指定日期的日记
router.get('/diaries/date/:date', async (req, res) => {
  if (!req.session || !req.session.isAuthenticated) {
    return res.status(401).json({ error: '未登录，请先登录' });
  }

  const userId = req.session.userId;
  const { date } = req.params;

  try {
    const sql = 'SELECT * FROM `diaries` WHERE `user_id` = ? AND `diary_date` = ? ORDER BY `created_at` DESC';
    const [rows] = await pool.query(sql, [userId, date]);

    res.json({
      success: true,
      data: rows,
      count: rows.length
    });
  } catch (err) {
    console.error('DB error:', err);
    res.status(500).json({ error: 'Database error', detail: err.message });
  }
});

// 获取单篇日记详情
router.get('/diaries/:id', async (req, res) => {
  if (!req.session || !req.session.isAuthenticated) {
    return res.status(401).json({ error: '未登录，请先登录' });
  }

  const userId = req.session.userId;
  const diaryId = req.params.id;

  try {
    const sql = 'SELECT * FROM `diaries` WHERE `id` = ? AND `user_id` = ?';
    const [rows] = await pool.query(sql, [diaryId, userId]);

    if (rows.length === 0) {
      return res.status(404).json({ error: '日记不存在或无权限访问' });
    }

    res.json({
      success: true,
      data: rows[0]
    });
  } catch (err) {
    console.error('DB error:', err);
    res.status(500).json({ error: 'Database error', detail: err.message });
  }
});

// 添加日记
router.post('/diaries', async (req, res) => {
  if (!req.session || !req.session.isAuthenticated) {
    return res.status(401).json({ error: '未登录，请先登录' });
  }

  const userId = req.session.userId;
  const { title, content, diary_date, mood, weather, tags } = req.body;

  // 验证必填字段
  if (!content || !content.trim()) {
    return res.status(400).json({ error: '请填写日记内容' });
  }

  // 如果没有提供日期，使用当前日期
  const finalDate = diary_date || new Date().toISOString().split('T')[0];

  // 验证日期格式
  if (!/^\d{4}-\d{2}-\d{2}$/.test(finalDate)) {
    return res.status(400).json({ error: '日期格式错误，请使用YYYY-MM-DD格式' });
  }

  try {
    const sql = `
      INSERT INTO \`diaries\` 
      (\`user_id\`, \`title\`, \`content\`, \`diary_date\`, \`mood\`, \`weather\`, \`tags\`) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const [result] = await pool.execute(sql, [
      userId,
      title || null,
      content.trim(),
      finalDate,
      mood || null,
      weather || null,
      tags || null
    ]);

    res.json({
      success: true,
      message: '日记添加成功',
      data: {
        id: result.insertId,
        user_id: userId,
        title: title || null,
        content: content.trim(),
        diary_date: finalDate,
        mood: mood || null,
        weather: weather || null,
        tags: tags || null
      }
    });
  } catch (err) {
    console.error('DB error:', err);
    res.status(500).json({ error: 'Database error', detail: err.message });
  }
});

// 更新日记
router.put('/diaries/:id', async (req, res) => {
  if (!req.session || !req.session.isAuthenticated) {
    return res.status(401).json({ error: '未登录，请先登录' });
  }

  const userId = req.session.userId;
  const diaryId = req.params.id;
  const { title, content, diary_date, mood, weather, tags } = req.body;

  // 验证必填字段
  if (!content || !content.trim()) {
    return res.status(400).json({ error: '请填写日记内容' });
  }

  // 验证日期格式
  if (diary_date && !/^\d{4}-\d{2}-\d{2}$/.test(diary_date)) {
    return res.status(400).json({ error: '日期格式错误，请使用YYYY-MM-DD格式' });
  }

  try {
    // 先检查日记是否存在且属于当前用户
    const [checkRows] = await pool.query(
      'SELECT * FROM `diaries` WHERE `id` = ? AND `user_id` = ?',
      [diaryId, userId]
    );

    if (checkRows.length === 0) {
      return res.status(404).json({ error: '日记不存在或无权限访问' });
    }

    // 更新日记
    const sql = `
      UPDATE \`diaries\` 
      SET \`title\` = ?, \`content\` = ?, \`diary_date\` = ?, \`mood\` = ?, \`weather\` = ?, \`tags\` = ?
      WHERE \`id\` = ? AND \`user_id\` = ?
    `;
    await pool.execute(sql, [
      title || null,
      content.trim(),
      diary_date || checkRows[0].diary_date,
      mood || null,
      weather || null,
      tags || null,
      diaryId,
      userId
    ]);

    res.json({
      success: true,
      message: '日记更新成功'
    });
  } catch (err) {
    console.error('DB error:', err);
    res.status(500).json({ error: 'Database error', detail: err.message });
  }
});

// 删除日记
router.delete('/diaries/:id', async (req, res) => {
  if (!req.session || !req.session.isAuthenticated) {
    return res.status(401).json({ error: '未登录，请先登录' });
  }

  const userId = req.session.userId;
  const diaryId = req.params.id;

  try {
    // 先检查日记是否存在且属于当前用户
    const [checkRows] = await pool.query(
      'SELECT * FROM `diaries` WHERE `id` = ? AND `user_id` = ?',
      [diaryId, userId]
    );

    if (checkRows.length === 0) {
      return res.status(404).json({ error: '日记不存在或无权限访问' });
    }

    // 删除日记
    const sql = 'DELETE FROM `diaries` WHERE `id` = ? AND `user_id` = ?';
    await pool.execute(sql, [diaryId, userId]);

    res.json({
      success: true,
      message: '日记删除成功'
    });
  } catch (err) {
    console.error('DB error:', err);
    res.status(500).json({ error: 'Database error', detail: err.message });
  }
});

module.exports = router;








