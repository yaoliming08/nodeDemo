const express = require('express');
const mysql = require('mysql2/promise');

const app = express();
const port = 3000;

// 根据你的本地设置修改下面几个参数
const dbConfig = {
  host: 'localhost',      // 或者 127.0.0.1
  port: 3306,             // 如果 mysql95 改了端口，这里也要改
  user: 'root',           // 如果不是 root，改成你自己的 MySQL 用户名
  password: '199808',     // 你提供的密码
  database: 'xl'          // 你截图里的库名
};

// 创建连接池
const pool = mysql.createPool(dbConfig);

app.use(express.json());

// 简单测试接口
app.get('/', (req, res) => {
  res.send('MySQL95 backend is running');
});

// 查询 xl.test01.user 表中所有数据
app.get('/users', async (req, res) => {
  try {
    const sql = 'SELECT * FROM `test01`.`user`';
    const [rows] = await pool.query(sql);
    res.json(rows);
  } catch (err) {
    console.error('DB error:', err);
    res.status(500).json({ error: 'Database error', detail: err.message });
  }
});

// 往 xl.test01.user 表里插入一条数据（假设 user 字段是 bigint）
app.post('/users', async (req, res) => {
  const { user } = req.body;
  if (user === undefined) {
    return res.status(400).json({ error: 'Missing field: user' });
  }
  try {
    const sql = 'INSERT INTO `test01`.`user` (`user`) VALUES (?)';
    const [result] = await pool.execute(sql, [user]);
    res.json({ id: result.insertId, user });
  } catch (err) {
    console.error('DB error:', err);
    res.status(500).json({ error: 'Database error', detail: err.message });
  }
});

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});


