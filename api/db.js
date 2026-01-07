// 数据库连接配置
const mysql = require('mysql2/promise');

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

module.exports = pool;








