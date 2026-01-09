// 检查并添加用户身高字段
const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '199808',
  database: 'xl'
};

async function checkAndAddHeight() {
  try {
    console.log('📡 正在连接数据库...');
    const connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功\n');

    // 检查user表结构
    console.log('🔍 检查user表结构...');
    const [columns] = await connection.query('DESCRIBE user');
    const columnNames = columns.map(col => col.Field);
    console.log('现有字段:', columnNames.join(', '));
    console.log('');

    // 检查height字段是否存在
    if (!columnNames.includes('height')) {
      console.log('➕ 添加字段: height');
      try {
        await connection.query(`
          ALTER TABLE \`user\` 
          ADD COLUMN \`height\` DECIMAL(5,2) DEFAULT NULL COMMENT '身高（厘米）' AFTER \`age\`
        `);
        console.log('✅ 字段 height 添加成功\n');
      } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME') {
          console.log('⚠️  字段 height 已存在，跳过\n');
        } else {
          console.error('❌ 添加字段 height 失败:', err.message);
          throw err;
        }
      }
    } else {
      console.log('✓ 字段 height 已存在，跳过\n');
    }

    // 再次检查表结构
    console.log('🔍 最终user表结构:');
    const [finalColumns] = await connection.query('DESCRIBE user');
    finalColumns.forEach(col => {
      if (col.Field === 'height' || col.Field === 'age' || col.Field === 'gender') {
        console.log(`  ${col.Field} - ${col.Type} - ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'}`);
      }
    });

    await connection.end();
    console.log('\n✅ 检查完成！');
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

checkAndAddHeight();



