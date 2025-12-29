// 检查user表的自增字段
const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '199808',
  database: 'xl'
};

async function checkAutoIncrement() {
  let connection;
  
  try {
    connection = await mysql.createConnection(dbConfig);
    
    // 检查自增字段
    const [autoIncrement] = await connection.query(`
      SELECT COLUMN_NAME, EXTRA, COLUMN_KEY
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'xl'
      AND TABLE_NAME = 'user'
      AND EXTRA LIKE '%auto_increment%'
    `);
    
    console.log('🔄 自增字段信息：');
    if (autoIncrement.length > 0) {
      console.table(autoIncrement);
    } else {
      console.log('⚠️  未找到自增字段');
    }
    
    // 检查所有字段
    const [columns] = await connection.query("DESCRIBE user");
    console.log('\n📋 user表所有字段：');
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

checkAutoIncrement();


