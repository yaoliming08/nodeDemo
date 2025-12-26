// 检查user表结构
const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '199808',
  database: 'xl'
};

async function checkUserTable() {
  let connection;
  
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功\n');

    // 检查user表是否存在
    const [tables] = await connection.query("SHOW TABLES LIKE 'user'");
    if (tables.length === 0) {
      console.log('❌ user表不存在');
      return;
    }

    console.log('📋 user表结构：');
    const [columns] = await connection.query("DESCRIBE user");
    console.table(columns);

    // 检查主键
    const [keys] = await connection.query(`
      SELECT COLUMN_NAME, CONSTRAINT_NAME 
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
      WHERE TABLE_SCHEMA = 'xl' 
      AND TABLE_NAME = 'user' 
      AND CONSTRAINT_NAME = 'PRIMARY'
    `);
    
    console.log('\n🔑 主键信息：');
    if (keys.length > 0) {
      console.table(keys);
    } else {
      console.log('⚠️  未找到主键');
    }

  } catch (err) {
    console.error('❌ 检查失败:', err.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

checkUserTable();

