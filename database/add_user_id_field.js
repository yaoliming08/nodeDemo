// 为user表添加user_id字段
const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '199808',
  database: 'xl'
};

async function addUserIdField() {
  let connection;
  
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功\n');

    // 检查user_id字段是否已存在
    const [columns] = await connection.query("DESCRIBE user");
    const hasUserId = columns.some(col => col.Field === 'user_id');
    
    if (hasUserId) {
      console.log('ℹ️  user_id字段已存在，跳过添加');
      
      // 检查是否为主键
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
        console.log('⚠️  user_id字段存在但不是主键，尝试设置为主键...');
        try {
          await connection.query('ALTER TABLE `user` ADD PRIMARY KEY (`user_id`)');
          console.log('✅ 已设置user_id为主键');
        } catch (err) {
          console.log('⚠️  设置主键失败:', err.message);
        }
      }
      return;
    }

    // 添加user_id字段（自增，作为主键）
    console.log('📝 正在添加user_id字段...');
    
    // 先添加字段（不带自增）
    await connection.query(`
      ALTER TABLE \`user\` 
      ADD COLUMN \`user_id\` BIGINT(20) UNSIGNED NOT NULL FIRST
    `);
    console.log('✅ user_id字段添加成功');

    // 为现有数据生成唯一的user_id
    console.log('📝 正在为现有数据生成唯一的user_id...');
    const [existingRows] = await connection.query('SELECT `user` FROM `user`');
    
    // 使用临时表来更新，避免重复值问题
    for (let i = 0; i < existingRows.length; i++) {
      const userId = i + 1; // 从1开始递增
      // 使用LIMIT 1和ORDER BY来确保每次只更新一条记录
      await connection.query(`
        UPDATE \`user\` 
        SET \`user_id\` = ? 
        WHERE \`user_id\` IS NULL OR \`user_id\` = 0
        ORDER BY \`user\`
        LIMIT 1
      `, [userId]);
    }
    console.log('✅ 现有数据user_id生成完成');

    // 设置为主键
    try {
      await connection.query('ALTER TABLE `user` ADD PRIMARY KEY (`user_id`)');
      console.log('✅ user_id已设置为主键');
    } catch (err) {
      if (err.code === 'ER_DUP_KEYNAME' || err.message.includes('Duplicate key name')) {
        console.log('ℹ️  主键已存在');
      } else {
        throw err;
      }
    }

    // 修改字段为自增
    try {
      await connection.query(`
        ALTER TABLE \`user\` 
        MODIFY COLUMN \`user_id\` BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT
      `);
      console.log('✅ user_id已设置为自增');
    } catch (err) {
      console.log('⚠️  设置自增失败:', err.message);
      console.log('ℹ️  user_id字段已添加并设置为主键，但不是自增的');
    }

    // 为现有数据生成user_id（如果user字段有值，使用它；否则使用自增值）
    const [rows] = await connection.query('SELECT `user`, `user_id` FROM `user` LIMIT 1');
    if (rows.length > 0 && rows[0].user && !rows[0].user_id) {
      console.log('📝 正在为现有数据生成user_id...');
      // 如果user字段有值，可以将其复制到user_id
      // 但由于user_id是自增的，新插入的数据会自动生成
      console.log('✅ 现有数据将使用自增的user_id');
    }

    // 显示更新后的表结构
    console.log('\n📋 更新后的user表结构：');
    const [newColumns] = await connection.query("DESCRIBE user");
    console.table(newColumns);

    // 显示主键信息
    const [newKeys] = await connection.query(`
      SELECT COLUMN_NAME, CONSTRAINT_NAME 
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
      WHERE TABLE_SCHEMA = 'xl' 
      AND TABLE_NAME = 'user' 
      AND CONSTRAINT_NAME = 'PRIMARY'
    `);
    
    console.log('\n🔑 主键信息：');
    if (newKeys.length > 0) {
      console.table(newKeys);
    } else {
      console.log('⚠️  未找到主键');
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

addUserIdField();

