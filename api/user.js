// 用户管理相关接口
const express = require('express');
const router = express.Router();
const pool = require('./db');
const { createRandomUser } = require('./utils');

// 查询 xl.user 表中所有数据
router.get('/users', async (req, res) => {
  try {
    const sql = 'SELECT * FROM `user`';
    const [rows] = await pool.query(sql);
    res.json(rows);
  } catch (err) {
    console.error('DB error:', err);
    res.status(500).json({ error: 'Database error', detail: err.message });
  }
});

// 根据用户名查询用户数据（支持模糊搜索）
router.get('/users/search', async (req, res) => {
  const { username } = req.query;
  
  if (!username) {
    return res.status(400).json({ error: '请提供用户名参数 username' });
  }

  try {
    // 使用 LIKE 进行模糊搜索，% 表示任意字符
    const sql = 'SELECT * FROM `user` WHERE `username` LIKE ?';
    const searchPattern = `%${username}%`;
    const [rows] = await pool.query(sql, [searchPattern]);
    
    if (rows.length === 0) {
      return res.json({ message: '未找到匹配的用户', data: [] });
    }
    
    // 返回所有匹配的结果
    res.json({ message: '查询成功', data: rows, count: rows.length });
  } catch (err) {
    console.error('DB error:', err);
    res.status(500).json({ error: 'Database error', detail: err.message });
  }
});

// 往 xl.user 表里插入一条完整的用户数据
router.post('/users', async (req, res) => {
  const { username, password, gender, age, phone, id_card } = req.body;

  if (!username || !password || !gender || !age || !phone || !id_card) {
    return res.status(400).json({ error: '缺少字段，请提供 username, password, gender, age, phone, id_card' });
  }

  try {
    const sql = 'INSERT INTO `user` (`username`, `password`, `gender`, `age`, `phone`, `id_card`) VALUES (?, ?, ?, ?, ?, ?)';
    const [result] = await pool.execute(sql, [username, password, gender, age, phone, id_card]);
    res.json({ id: result.insertId, username, gender, age, phone, id_card });
  } catch (err) {
    console.error('DB error:', err);
    res.status(500).json({ error: 'Database error', detail: err.message });
  }
});

// 一次性往表里插入 100 条模拟数据
router.get('/seed-users', async (req, res) => {
  const users = [];
  for (let i = 1; i <= 100; i++) {
    users.push(createRandomUser(i));
  }

  const sql = 'INSERT INTO `user` (`username`, `password`, `gender`, `age`, `phone`, `id_card`) VALUES ?';
  const values = users.map(u => [u.username, u.password, u.gender, u.age, u.phone, u.id_card]);

  try {
    const [result] = await pool.query(sql, [values]);
    res.json({ inserted: result.affectedRows });
  } catch (err) {
    console.error('DB error:', err);
    res.status(500).json({ error: 'Database error', detail: err.message });
  }
});

// 获取当前登录用户信息
router.get('/user/info', async (req, res) => {
  if (!req.session || !req.session.isAuthenticated) {
    return res.status(401).json({ error: '未登录，请先登录' });
  }

  const userId = req.session.userId;

  try {
    const [rows] = await pool.query(
      'SELECT `user_id`, `username`, `gender`, `age`, `height` FROM `user` WHERE `user_id` = ?',
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    const userData = {
      user_id: rows[0].user_id,
      username: rows[0].username,
      gender: rows[0].gender,
      age: rows[0].age,
      height: rows[0].height ? parseFloat(rows[0].height) : null
    };
    
    console.log('📤 返回用户信息:', userData);
    
    res.json({
      success: true,
      data: userData
    });
  } catch (err) {
    console.error('获取用户信息失败:', err);
    res.status(500).json({ error: 'Database error', detail: err.message });
  }
});

// 更新当前登录用户信息
router.post('/user/update', async (req, res) => {
  if (!req.session || !req.session.isAuthenticated) {
    return res.status(401).json({ error: '未登录，请先登录' });
  }

  const userId = req.session.userId;
  const { age, height } = req.body;

  try {
    const updates = [];
    const values = [];

    if (age !== undefined) {
      const ageNum = parseInt(age);
      if (isNaN(ageNum) || ageNum < 1 || ageNum > 120) {
        return res.status(400).json({ error: '请输入有效的年龄（1-120）' });
      }
      updates.push('`age` = ?');
      values.push(ageNum);
    }

    if (height !== undefined) {
      const heightNum = parseFloat(height);
      if (isNaN(heightNum) || heightNum < 50 || heightNum > 250) {
        return res.status(400).json({ error: '请输入有效的身高（50-250厘米）' });
      }
      updates.push('`height` = ?');
      values.push(heightNum);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: '请提供要更新的字段（age 或 height）' });
    }

    values.push(userId);

    const sql = `UPDATE \`user\` SET ${updates.join(', ')} WHERE \`user_id\` = ?`;
    await pool.query(sql, values);

    res.json({
      success: true,
      message: '更新成功'
    });
  } catch (err) {
    console.error('更新用户信息失败:', err);
    res.status(500).json({ error: 'Database error', detail: err.message });
  }
});

module.exports = router;








