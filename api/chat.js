// 聊天室相关接口
const express = require('express');
const router = express.Router();
const pool = require('./db');

// 获取聊天消息列表（按时间倒序，最新的在前）
router.get('/chat/messages', async (req, res) => {
  // 检查是否已登录
  if (!req.session || !req.session.isAuthenticated) {
    return res.status(401).json({ error: '未登录，请先登录' });
  }

  const { limit = 50, before_id } = req.query;

  try {
    let sql = 'SELECT * FROM `chat_messages`';
    const params = [];

    // 如果提供了before_id，获取该消息之前的消息（用于分页）
    if (before_id) {
      sql += ' WHERE `id` < ?';
      params.push(before_id);
    }

    sql += ' ORDER BY `created_at` DESC LIMIT ?';
    params.push(parseInt(limit));

    const [rows] = await pool.query(sql, params);

    // 反转数组，让最旧的消息在前（方便前端显示）
    const messages = rows.reverse();

    res.json({
      success: true,
      data: messages,
      count: messages.length,
      hasMore: messages.length === parseInt(limit)
    });
  } catch (err) {
    console.error('DB error:', err);
    res.status(500).json({ error: 'Database error', detail: err.message });
  }
});

// 获取最新消息（用于实时刷新）
router.get('/chat/messages/latest', async (req, res) => {
  if (!req.session || !req.session.isAuthenticated) {
    return res.status(401).json({ error: '未登录，请先登录' });
  }

  const { after_id } = req.query;

  try {
    let sql = 'SELECT * FROM `chat_messages`';
    const params = [];

    // 如果提供了after_id，只获取该消息之后的新消息
    if (after_id) {
      sql += ' WHERE `id` > ?';
      params.push(after_id);
    }

    sql += ' ORDER BY `created_at` ASC';

    const [rows] = await pool.query(sql, params);

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

// 发送消息
router.post('/chat/messages', async (req, res) => {
  if (!req.session || !req.session.isAuthenticated) {
    return res.status(401).json({ error: '未登录，请先登录' });
  }

  const userId = req.session.userId;
  const username = req.session.username;
  const { message, message_type = 'text' } = req.body;

  // 验证必填字段
  if (!message || !message.trim()) {
    return res.status(400).json({ error: '消息内容不能为空' });
  }

  // 验证消息长度
  if (message.length > 5000) {
    return res.status(400).json({ error: '消息内容过长，最多5000字符' });
  }

  try {
    const sql = `
      INSERT INTO \`chat_messages\` 
      (\`user_id\`, \`username\`, \`message\`, \`message_type\`) 
      VALUES (?, ?, ?, ?)
    `;
    const [result] = await pool.execute(sql, [
      userId,
      username,
      message.trim(),
      message_type
    ]);

    // 返回刚插入的消息
    const [newMessage] = await pool.query(
      'SELECT * FROM `chat_messages` WHERE `id` = ?',
      [result.insertId]
    );

    res.json({
      success: true,
      message: '消息发送成功',
      data: newMessage[0]
    });
  } catch (err) {
    console.error('DB error:', err);
    res.status(500).json({ error: 'Database error', detail: err.message });
  }
});

// 获取在线用户数（简单统计，实际应该用更复杂的方式）
router.get('/chat/online', async (req, res) => {
  if (!req.session || !req.session.isAuthenticated) {
    return res.status(401).json({ error: '未登录，请先登录' });
  }

  try {
    // 统计最近5分钟内有发送消息的用户数（作为在线用户的简单估算）
    const sql = `
      SELECT COUNT(DISTINCT \`user_id\`) as online_count
      FROM \`chat_messages\`
      WHERE \`created_at\` >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
    `;
    const [rows] = await pool.query(sql);

    res.json({
      success: true,
      onlineCount: rows[0].online_count || 0
    });
  } catch (err) {
    console.error('DB error:', err);
    res.status(500).json({ error: 'Database error', detail: err.message });
  }
});

module.exports = router;








