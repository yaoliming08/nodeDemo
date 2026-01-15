// 检查并添加卡路里相关字段
const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '199808',
  database: 'xl'
};

async function checkAndAddFields() {
  try {
    console.log('📡 正在连接数据库...');
    const connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功\n');

    // 检查表结构
    console.log('🔍 检查表结构...');
    const [columns] = await connection.query('DESCRIBE weight_records');
    const columnNames = columns.map(col => col.Field);
    console.log('现有字段:', columnNames.join(', '));
    console.log('');

    // 需要添加的字段
    const fieldsToAdd = [
      {
        name: 'food_photos',
        sql: "ADD COLUMN `food_photos` TEXT DEFAULT NULL COMMENT '食物照片文件路径（JSON数组格式，存储多个照片路径）' AFTER `photos`"
      },
      {
        name: 'calories',
        sql: "ADD COLUMN `calories` DECIMAL(8,2) DEFAULT NULL COMMENT '当日总卡路里（大卡）' AFTER `food_photos`"
      },
      {
        name: 'calories_analysis',
        sql: "ADD COLUMN `calories_analysis` TEXT DEFAULT NULL COMMENT 'AI分析的卡路里详情（JSON格式）' AFTER `calories`"
      }
    ];

    let addedCount = 0;
    for (const field of fieldsToAdd) {
      if (!columnNames.includes(field.name)) {
        console.log(`➕ 添加字段: ${field.name}`);
        try {
          await connection.query(`ALTER TABLE \`weight_records\` ${field.sql}`);
          console.log(`✅ 字段 ${field.name} 添加成功\n`);
          addedCount++;
        } catch (err) {
          if (err.code === 'ER_DUP_FIELDNAME') {
            console.log(`⚠️  字段 ${field.name} 已存在，跳过\n`);
          } else {
            console.error(`❌ 添加字段 ${field.name} 失败:`, err.message);
            throw err;
          }
        }
      } else {
        console.log(`✓ 字段 ${field.name} 已存在，跳过\n`);
      }
    }

    // 再次检查表结构
    console.log('🔍 最终表结构:');
    const [finalColumns] = await connection.query('DESCRIBE weight_records');
    finalColumns.forEach(col => {
      if (col.Field.includes('food') || col.Field.includes('calories')) {
        console.log(`  ${col.Field} - ${col.Type} - ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'}`);
      }
    });

    await connection.end();
    
    if (addedCount > 0) {
      console.log(`\n✅ 成功添加 ${addedCount} 个字段！`);
    } else {
      console.log('\n✅ 所有字段都已存在！');
    }
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

checkAndAddFields();






