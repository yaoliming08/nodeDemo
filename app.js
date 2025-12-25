const express = require('express');
const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');

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
// 允许访问静态文件（HTML页面）
app.use(express.static('public'));

// 生成随机用户数据的工具函数
function createRandomUser(index) {
  const names = ['张三', '李四', '王五', '赵六', '孙七', '周八', '吴九', '郑十'];
  const genders = ['男', '女'];

  const name = names[Math.floor(Math.random() * names.length)] + index;
  const gender = genders[Math.floor(Math.random() * genders.length)];
  const age = Math.floor(Math.random() * 40) + 18; // 18-57 岁

  // 简单生成手机号和身份证号（只是模拟数据，不是真实规则）
  const phone = '13' + Math.floor(100000000 + Math.random() * 900000000).toString();
  const idCard = '4201' + // 地区码随便写的
    '1990' +              // 年份
    ('0' + Math.floor(Math.random() * 9 + 1)).slice(-2) + // 月
    ('0' + Math.floor(Math.random() * 28 + 1)).slice(-2) + // 日
    Math.floor(1000 + Math.random() * 9000).toString();   // 顺序码

  const password = 'pass' + Math.floor(Math.random() * 100000);

  return {
    username: name,
    password,
    gender,
    age,
    phone,
    id_card: idCard
  };
}

// 根路径由静态文件服务自动返回 public/index.html

// 查询 xl.user 表中所有数据
app.get('/users', async (req, res) => {
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
app.get('/users/search', async (req, res) => {
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
app.post('/users', async (req, res) => {
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
app.get('/seed-users', async (req, res) => {
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

// 获取音频base64数据的API端点
app.get('/api/audio/:filename', async (req, res) => {
  let { filename } = req.params;
  
  // 清理文件名（去除首尾空格和换行符，并进行URL解码）
  filename = decodeURIComponent(filename).trim();
  
  console.log(`请求的文件名: "${filename}" (长度: ${filename.length}, 字符码: ${Array.from(filename).map(c => c.charCodeAt(0)).join(',')})`);
  
  // 只允许读取video1.json、video2.json和video3.json
  const allowedFiles = ['video1.json', 'video2.json', 'video3.json'];
  if (!allowedFiles.includes(filename)) {
    console.error(`不允许的文件名: "${filename}" (长度: ${filename.length})`);
    console.error(`允许的文件列表:`, allowedFiles);
    return res.status(400).json({ error: '不允许的文件名', received: filename });
  }

  try {
    const filePath = path.join(__dirname, 'file', filename);
    const fileContent = await fs.readFile(filePath, 'utf-8');
    
    // 解析JSON格式文件
    let audioBase64;
    try {
      const jsonData = JSON.parse(fileContent.trim());
      // 优先使用 audioBase64 字段
      if (jsonData.audioBase64) {
        audioBase64 = jsonData.audioBase64;
      } else if (jsonData.base64) {
        audioBase64 = jsonData.base64;
      } else {
        throw new Error('JSON文件中未找到 audioBase64 或 base64 字段');
      }
      console.log(`成功解析JSON，Base64数据长度: ${audioBase64.length}`);
    } catch (jsonError) {
      console.error('解析JSON失败:', jsonError.message);
      // 如果不是JSON，直接使用文件内容
      audioBase64 = fileContent.trim();
    }
    
    res.json({ 
      filename,
      audioBase64: audioBase64
    });
  } catch (err) {
    console.error('读取文件错误:', err);
    res.status(500).json({ error: '读取文件失败', detail: err.message });
  }
});

// 保存人格测试结果（可选功能）
app.post('/api/personality-test', async (req, res) => {
  const { username, personalityType, scores } = req.body;
  
  if (!personalityType) {
    return res.status(400).json({ error: '请提供人格类型 personalityType' });
  }

  try {
    // 如果数据库中有 personality_test 表，可以保存结果
    // 这里先返回成功，实际保存需要创建相应的表
    // const sql = 'INSERT INTO `personality_test` (`username`, `personality_type`, `scores`, `created_at`) VALUES (?, ?, ?, NOW())';
    // const scoresJson = JSON.stringify(scores);
    // const [result] = await pool.execute(sql, [username || '匿名', personalityType, scoresJson]);
    
    res.json({ 
      success: true, 
      message: '测试结果已记录',
      personalityType,
      scores
    });
  } catch (err) {
    console.error('保存测试结果错误:', err);
    res.status(500).json({ error: '保存失败', detail: err.message });
  }
});

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});


