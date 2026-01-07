// 执行SQL脚本创建weight_records表
const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');

// 数据库配置（与api/db.js保持一致）
const dbConfig = {
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '199808',
  database: 'xl'
};

async function createTable() {
  let connection;
  
  try {
    // 创建数据库连接
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功');

    // 读取SQL文件
    const sqlFile = path.join(__dirname, 'weight_records_table.sql');
    const sqlContent = await fs.readFile(sqlFile, 'utf-8');
    
    // 移除注释行，只保留SQL语句
    const sqlStatements = sqlContent
      .split('\n')
      .filter(line => {
        const trimmed = line.trim();
        return trimmed && !trimmed.startsWith('--') && !trimmed.startsWith('/*');
      })
      .join('\n')
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    // 执行SQL语句
    for (const sql of sqlStatements) {
      if (sql.trim()) {
        await connection.query(sql);
        console.log('✅ 执行SQL语句成功');
      }
    }

    // 验证表是否创建成功
    const [tables] = await connection.query("SHOW TABLES LIKE 'weight_records'");
    if (tables.length > 0) {
      console.log('✅ weight_records表创建成功！');
      
      // 显示表结构
      const [columns] = await connection.query("DESCRIBE weight_records");
      console.log('\n📋 表结构：');
      console.table(columns);
    } else {
      console.log('⚠️  表可能未创建成功，请检查SQL语句');
    }

  } catch (err) {
    console.error('❌ 创建表失败:', err.message);
    console.error('错误详情:', err);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n✅ 数据库连接已关闭');
    }
  }
}

// 执行创建
createTable();

