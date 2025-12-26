// 修复user表的user_id字段，确保唯一并设置为主键
const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '199808',
  database: 'xl'
};

async function fixUserId() {
  let connection;
  
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功\n');

    // 检查user_id字段
    const [columns] = await connection.query("DESCRIBE user");
    const userIdColumn = columns.find(col => col.Field === 'user_id');
    
    if (!userIdColumn) {
      console.log('❌ user_id字段不存在，请先运行 add_user_id_field.js');
      return;
    }

    console.log('📋 当前user_id字段信息：');
    console.log(userIdColumn);

    // 检查现有数据中是否有重复或无效的user_id
    const [duplicateCheck] = await connection.query(`
      SELECT \`user_id\`, COUNT(*) as cnt 
      FROM \`user\` 
      GROUP BY \`user_id\` 
      HAVING cnt > 1 OR \`user_id\` IS NULL OR \`user_id\` = 0
    `);
    
    if (duplicateCheck.length > 0) {
      console.log('\n⚠️  发现重复或无效的user_id，正在修复...');
      
      // 获取所有记录
      const [allRows] = await connection.query('SELECT `user` FROM `user` ORDER BY `user`');
      
      // 为每条记录分配唯一的user_id
      for (let i = 0; i < allRows.length; i++) {
        const newUserId = i + 1;
        // 使用临时变量来更新
        await connection.query(`
          UPDATE \`user\` 
          SET \`user_id\` = ? 
          WHERE \`user\` = ?
        `, [newUserId, allRows[i].user]);
      }
      console.log('✅ 所有记录的user_id已更新为唯一值');
    } else {
      console.log('✅ 所有user_id都是唯一的');
    }

    // 检查是否已有主键
    const [keys] = await connection.query(`
      SELECT COLUMN_NAME, CONSTRAINT_NAME 
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
      WHERE TABLE_SCHEMA = 'xl' 
      AND TABLE_NAME = 'user' 
      AND CONSTRAINT_NAME = 'PRIMARY'
    `);
    
    if (keys.length > 0) {
      console.log('✅ user_id已是主键');
      console.table(keys);
    } else {
      console.log('\n📝 正在设置user_id为主键...');
      try {
        await connection.query('ALTER TABLE `user` ADD PRIMARY KEY (`user_id`)');
        console.log('✅ user_id已设置为主键');
      } catch (err) {
        console.error('❌ 设置主键失败:', err.message);
        throw err;
      }
    }

    // 设置自增
    console.log('\n📝 正在设置user_id为自增...');
    try {
      await connection.query(`
        ALTER TABLE \`user\` 
        MODIFY COLUMN \`user_id\` BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT
      `);
      console.log('✅ user_id已设置为自增');
    } catch (err) {
      console.log('⚠️  设置自增失败:', err.message);
      console.log('ℹ️  user_id已设置为主键，但不是自增的');
    }

    // 显示最终表结构
    console.log('\n📋 最终user表结构：');
    const [finalColumns] = await connection.query("DESCRIBE user");
    console.table(finalColumns);

    // 显示主键信息
    const [finalKeys] = await connection.query(`
      SELECT COLUMN_NAME, CONSTRAINT_NAME 
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
      WHERE TABLE_SCHEMA = 'xl' 
      AND TABLE_NAME = 'user' 
      AND CONSTRAINT_NAME = 'PRIMARY'
    `);
    
    console.log('\n🔑 主键信息：');
    if (finalKeys.length > 0) {
      console.table(finalKeys);
    }

  } catch (err) {
    console.error('❌ 操作失败:', err.message);
    console.error('错误详情:', err);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n✅ 数据库连接已关闭');
    }
  }
}

fixUserId();

