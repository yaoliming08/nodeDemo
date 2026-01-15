// 运行SQL文件的简单脚本
// 使用方法: node sql/run_sql.js <sql文件路径>

const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');

// 数据库配置（从api/db.js读取或使用环境变量）
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '199808',
  database: process.env.DB_NAME || 'xl',
  multipleStatements: true // 允许执行多条SQL语句
};

async function runSQL(sqlFilePath) {
  try {
    // 读取SQL文件
    const sqlContent = await fs.readFile(sqlFilePath, 'utf8');
    
    // 连接数据库
    console.log('📡 正在连接数据库...');
    const connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功');
    
    // 执行SQL
    console.log(`\n📝 正在执行SQL文件: ${sqlFilePath}`);
    console.log('─'.repeat(50));
    
    // 分割SQL语句（按分号分割，但要注意字符串中的分号）
    const statements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await connection.query(statement);
          console.log('✅ SQL语句执行成功');
        } catch (err) {
          // 如果是字段已存在的错误，忽略
          if (err.code === 'ER_DUP_FIELDNAME') {
            console.log('⚠️  字段已存在，跳过');
          } else {
            console.error('❌ SQL执行失败:', err.message);
            throw err;
          }
        }
      }
    }
    
    console.log('─'.repeat(50));
    console.log('✅ SQL文件执行完成！');
    
    // 关闭连接
    await connection.end();
    
  } catch (err) {
    console.error('❌ 执行失败:', err.message);
    if (err.code === 'ECONNREFUSED') {
      console.error('💡 提示: 请确保MySQL服务正在运行');
    } else if (err.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('💡 提示: 请检查数据库用户名和密码');
    } else if (err.code === 'ER_BAD_DB_ERROR') {
      console.error('💡 提示: 请检查数据库名称是否正确');
    }
    process.exit(1);
  }
}

// 获取命令行参数
const sqlFile = process.argv[2];

if (!sqlFile) {
  console.error('❌ 请指定SQL文件路径');
  console.log('\n使用方法:');
  console.log('  node sql/run_sql.js <sql文件路径>');
  console.log('\n示例:');
  console.log('  node sql/run_sql.js sql/add_calories_fields.sql');
  process.exit(1);
}

// 检查文件是否存在
const sqlFilePath = path.resolve(sqlFile);
fs.access(sqlFilePath)
  .then(() => runSQL(sqlFilePath))
  .catch(() => {
    console.error(`❌ 文件不存在: ${sqlFilePath}`);
    process.exit(1);
  });






