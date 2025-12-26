// 登录注册相关接口
const express = require('express');
const router = express.Router();
const pool = require('./db');

// 登录接口
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: '请提供用户名和密码' });
  }

  try {
    // 查询用户
    const sql = 'SELECT * FROM `user` WHERE `username` = ? AND `password` = ?';
    const [rows] = await pool.query(sql, [username, password]);

    if (rows.length === 0) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const user = rows[0];
    
    // 设置会话
    req.session.userId = user.user_id;
    req.session.username = user.username;
    req.session.isAuthenticated = true;

    res.json({
      success: true,
      message: '登录成功',
      user: {
        id: user.user_id,
        username: user.username,
        gender: user.gender,
        age: user.age
      }
    });
  } catch (err) {
    console.error('登录错误:', err);
    res.status(500).json({ error: '登录失败', detail: err.message });
  }
});

// 检查登录状态
router.get('/check-auth', (req, res) => {
  if (req.session && req.session.isAuthenticated) {
    res.json({
      isAuthenticated: true,
      user: {
        id: req.session.userId,
        username: req.session.username
      }
    });
  } else {
    res.json({
      isAuthenticated: false
    });
  }
});

// 注册接口
router.post('/register', async (req, res) => {
  const { username, password, gender, age, phone, id_card } = req.body;

  // 验证必填字段
  if (!username || !password || !gender || !age || !phone || !id_card) {
    return res.status(400).json({ error: '请填写所有必填字段' });
  }

  // 验证密码长度
  if (password.length < 6) {
    return res.status(400).json({ error: '密码长度至少为6位' });
  }

  // 验证年龄范围
  if (age < 1 || age > 120) {
    return res.status(400).json({ error: '请输入有效的年龄（1-120）' });
  }

  // 验证手机号格式
  if (!/^1[3-9]\d{9}$/.test(phone)) {
    return res.status(400).json({ error: '请输入正确的手机号格式' });
  }

  try {
    // 检查用户名是否已存在
    const checkSql = 'SELECT * FROM `user` WHERE `username` = ?';
    const [existingUsers] = await pool.query(checkSql, [username]);

    if (existingUsers.length > 0) {
      return res.status(400).json({ error: '用户名已存在，请选择其他用户名' });
    }

    // 检查手机号是否已存在
    const checkPhoneSql = 'SELECT * FROM `user` WHERE `phone` = ?';
    const [existingPhones] = await pool.query(checkPhoneSql, [phone]);

    if (existingPhones.length > 0) {
      return res.status(400).json({ error: '该手机号已被注册' });
    }

    // 插入新用户
    const sql = 'INSERT INTO `user` (`username`, `password`, `gender`, `age`, `phone`, `id_card`) VALUES (?, ?, ?, ?, ?, ?)';
    const [result] = await pool.execute(sql, [username, password, gender, age, phone, id_card]);

    res.json({
      success: true,
      message: '注册成功',
      user: {
        id: result.insertId,
        username,
        gender,
        age,
        phone
      }
    });
  } catch (err) {
    console.error('注册错误:', err);
    
    // 处理数据库唯一约束错误
    if (err.code === 'ER_DUP_ENTRY') {
      if (err.message.includes('username')) {
        return res.status(400).json({ error: '用户名已存在，请选择其他用户名' });
      } else if (err.message.includes('phone')) {
        return res.status(400).json({ error: '该手机号已被注册' });
      }
    }
    
    res.status(500).json({ error: '注册失败', detail: err.message });
  }
});

// 登出接口
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('登出错误:', err);
      return res.status(500).json({ error: '登出失败' });
    }
    res.json({ success: true, message: '已成功登出' });
  });
});

module.exports = router;

