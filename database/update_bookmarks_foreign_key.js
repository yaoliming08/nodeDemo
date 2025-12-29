// 更新bookmarks表的外键约束，关联到user.user_id
const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '199808',
  database: 'xl'
};

async function updateForeignKey() {
  let connection;
  
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功\n');

    // 检查是否已有外键约束
    const [existingFK] = await connection.query(`
      SELECT CONSTRAINT_NAME, TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = 'xl'
      AND TABLE_NAME = 'bookmarks'
      AND REFERENCED_TABLE_NAME IS NOT NULL
    `);

    if (existingFK.length > 0) {
      console.log('ℹ️  已存在外键约束：');
      console.table(existingFK);
      
      // 检查是否指向正确的字段
      const fk = existingFK[0];
      if (fk.REFERENCED_COLUMN_NAME === 'user_id') {
        console.log('✅ 外键已正确关联到user.user_id');
        return;
      } else {
        console.log('⚠️  外键关联到错误的字段，需要删除后重新创建');
        await connection.query(`ALTER TABLE \`bookmarks\` DROP FOREIGN KEY \`${fk.CONSTRAINT_NAME}\``);
        console.log('✅ 已删除旧的外键约束');
      }
    }

    // 添加外键约束
    console.log('\n📝 正在添加外键约束...');
    try {
      await connection.query(`
        ALTER TABLE \`bookmarks\`
        ADD CONSTRAINT \`fk_bookmarks_user\`
        FOREIGN KEY (\`user_id\`) REFERENCES \`user\` (\`user_id\`)
        ON DELETE CASCADE ON UPDATE CASCADE
      `);
      console.log('✅ 外键约束添加成功');
    } catch (err) {
      if (err.code === 'ER_DUP_KEYNAME') {
        console.log('ℹ️  外键约束已存在');
      } else {
        throw err;
      }
    }

    // 显示外键信息
    const [fkInfo] = await connection.query(`
      SELECT CONSTRAINT_NAME, TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = 'xl'
      AND TABLE_NAME = 'bookmarks'
      AND REFERENCED_TABLE_NAME IS NOT NULL
    `);

    console.log('\n🔗 外键约束信息：');
    if (fkInfo.length > 0) {
      console.table(fkInfo);
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

updateForeignKey();


