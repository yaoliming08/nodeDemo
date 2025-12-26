// 修复user表的user_id字段，确保唯一并设置为主键（改进版）
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

    // 先查看当前数据
    const [currentData] = await connection.query('SELECT `user_id`, `user`, `username` FROM `user` LIMIT 10');
    console.log('📋 当前数据示例（前10条）：');
    console.table(currentData);

    // 使用临时表来更新所有user_id
    console.log('\n📝 正在为所有记录生成唯一的user_id...');
    
    // 方法：使用变量来生成唯一的user_id（分开执行）
    await connection.query('SET @row_number = 0');
    await connection.query(`
      UPDATE \`user\` 
      SET \`user_id\` = (@row_number := @row_number + 1)
      ORDER BY \`user\`
    `);
    
    console.log('✅ 所有记录的user_id已更新为唯一值');

    // 验证是否还有重复
    const [duplicateCheck] = await connection.query(`
      SELECT \`user_id\`, COUNT(*) as cnt 
      FROM \`user\` 
      GROUP BY \`user_id\` 
      HAVING cnt > 1
    `);
    
    if (duplicateCheck.length > 0) {
      console.log('⚠️  仍有重复的user_id:', duplicateCheck);
      throw new Error('存在重复的user_id，无法设置主键');
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
      // 先获取当前最大的user_id
      const [maxResult] = await connection.query('SELECT MAX(`user_id`) as max_id FROM `user`');
      const maxId = maxResult[0].max_id || 0;
      
      await connection.query(`
        ALTER TABLE \`user\` 
        MODIFY COLUMN \`user_id\` BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT
      `);
      
      // 设置自增起始值
      await connection.query(`ALTER TABLE \`user\` AUTO_INCREMENT = ${maxId + 1}`);
      console.log('✅ user_id已设置为自增，起始值为', maxId + 1);
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

    // 显示更新后的数据示例
    const [updatedData] = await connection.query('SELECT `user_id`, `user`, `username` FROM `user` LIMIT 5');
    console.log('\n📋 更新后的数据示例（前5条）：');
    console.table(updatedData);

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

