// 智能数据库初始化脚本
// 功能：自动检测表是否存在，字段是否完整，自动创建/更新表结构

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

// SQL文件列表（按依赖顺序）
const sqlFiles = [
  'bookmarks.sql',
  'chat_messages.sql',
  'diaries.sql',
  'weight_records.sql'
];

// 解析SQL文件，提取表名和字段信息
function parseSQL(sqlContent) {
  // 移除注释
  const cleanSQL = sqlContent
    .split('\n')
    .filter(line => {
      const trimmed = line.trim();
      return trimmed && !trimmed.startsWith('--') && !trimmed.startsWith('/*');
    })
    .join('\n');

  // 提取表名
  const tableMatch = cleanSQL.match(/CREATE TABLE IF NOT EXISTS `(\w+)`/i);
  if (!tableMatch) return null;

  const tableName = tableMatch[1];

  // 提取字段定义
  const fields = [];
  const fieldRegex = /`(\w+)`\s+([^,\n]+)/g;
  let match;
  while ((match = fieldRegex.exec(cleanSQL)) !== null) {
    const fieldName = match[1];
    const fieldDef = match[2].trim();
    fields.push({ name: fieldName, definition: fieldDef });
  }

  // 提取索引
  const indexes = [];
  const indexRegex = /(?:KEY|UNIQUE KEY|PRIMARY KEY)\s+`?(\w+)`?\s*\(`(\w+)`(?:,\s*`(\w+)`)?\)/g;
  while ((match = indexRegex.exec(cleanSQL)) !== null) {
    indexes.push({
      name: match[1],
      columns: match[3] ? [match[2], match[3]] : [match[2]]
    });
  }

  // 提取外键
  const foreignKeys = [];
  const fkRegex = /CONSTRAINT `(\w+)` FOREIGN KEY \(`(\w+)`\) REFERENCES `(\w+)` \(`(\w+)`\)/g;
  while ((match = fkRegex.exec(cleanSQL)) !== null) {
    foreignKeys.push({
      name: match[1],
      column: match[2],
      refTable: match[3],
      refColumn: match[4]
    });
  }

  return {
    tableName,
    fields,
    indexes,
    foreignKeys,
    fullSQL: cleanSQL
  };
}

// 检查表是否存在
async function tableExists(connection, tableName) {
  try {
    const [rows] = await connection.query(
      "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ? AND table_name = ?",
      [dbConfig.database, tableName]
    );
    return rows[0].count > 0;
  } catch (err) {
    return false;
  }
}

// 获取表的字段列表
async function getTableColumns(connection, tableName) {
  try {
    const [rows] = await connection.query(`DESCRIBE \`${tableName}\``);
    return rows.map(row => row.Field);
  } catch (err) {
    return [];
  }
}

// 获取表的索引列表
async function getTableIndexes(connection, tableName) {
  try {
    const [rows] = await connection.query(
      `SELECT INDEX_NAME, COLUMN_NAME 
       FROM information_schema.STATISTICS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? 
       ORDER BY INDEX_NAME, SEQ_IN_INDEX`,
      [dbConfig.database, tableName]
    );
    
    const indexMap = {};
    rows.forEach(row => {
      if (!indexMap[row.INDEX_NAME]) {
        indexMap[row.INDEX_NAME] = [];
      }
      indexMap[row.INDEX_NAME].push(row.COLUMN_NAME);
    });
    
    return indexMap;
  } catch (err) {
    return {};
  }
}

// 添加缺失的字段
async function addMissingColumns(connection, tableName, expectedFields, existingColumns) {
  const missingFields = expectedFields.filter(field => !existingColumns.includes(field.name));
  
  if (missingFields.length === 0) {
    return [];
  }

  const addedFields = [];
  for (const field of missingFields) {
    try {
      const alterSQL = `ALTER TABLE \`${tableName}\` ADD COLUMN \`${field.name}\` ${field.definition}`;
      await connection.query(alterSQL);
      addedFields.push(field.name);
      console.log(`  ✅ 添加字段: ${field.name}`);
    } catch (err) {
      console.error(`  ❌ 添加字段失败 ${field.name}:`, err.message);
    }
  }
  
  return addedFields;
}

// 添加缺失的索引
async function addMissingIndexes(connection, tableName, expectedIndexes, existingIndexes) {
  const addedIndexes = [];
  
  for (const expectedIndex of expectedIndexes) {
    const indexExists = existingIndexes[expectedIndex.name] || 
                       Object.values(existingIndexes).some(idx => 
                         JSON.stringify(idx) === JSON.stringify(expectedIndex.columns)
                       );
    
    if (!indexExists) {
      try {
        let indexSQL;
        if (expectedIndex.name === 'PRIMARY') {
          // 主键已经在CREATE TABLE中定义
          continue;
        } else if (expectedIndex.name.startsWith('uk_')) {
          indexSQL = `ALTER TABLE \`${tableName}\` ADD UNIQUE KEY \`${expectedIndex.name}\` (\`${expectedIndex.columns.join('`, `')}\`)`;
        } else {
          indexSQL = `ALTER TABLE \`${tableName}\` ADD KEY \`${expectedIndex.name}\` (\`${expectedIndex.columns.join('`, `')}\`)`;
        }
        
        await connection.query(indexSQL);
        addedIndexes.push(expectedIndex.name);
        console.log(`  ✅ 添加索引: ${expectedIndex.name}`);
      } catch (err) {
        console.error(`  ❌ 添加索引失败 ${expectedIndex.name}:`, err.message);
      }
    }
  }
  
  return addedIndexes;
}

// 处理单个SQL文件
async function processSQLFile(connection, sqlFilePath) {
  const fileName = path.basename(sqlFilePath);
  console.log(`\n📄 处理文件: ${fileName}`);
  
  try {
    // 读取SQL文件
    const sqlContent = await fs.readFile(sqlFilePath, 'utf-8');
    
    // 解析SQL
    const parsed = parseSQL(sqlContent);
    if (!parsed) {
      console.log(`  ⚠️  无法解析SQL文件: ${fileName}`);
      return { success: false, reason: 'parse_error' };
    }
    
    const { tableName, fields, indexes, foreignKeys, fullSQL } = parsed;
    console.log(`  📋 表名: ${tableName}`);
    
    // 检查表是否存在
    const exists = await tableExists(connection, tableName);
    
    if (!exists) {
      // 表不存在，直接创建
      console.log(`  🔨 表不存在，正在创建...`);
      try {
        await connection.query(fullSQL);
        console.log(`  ✅ 表创建成功: ${tableName}`);
        return { success: true, action: 'created', tableName };
      } catch (err) {
        console.error(`  ❌ 创建表失败:`, err.message);
        return { success: false, reason: err.message };
      }
    } else {
      // 表存在，检查字段和索引
      console.log(`  ✓ 表已存在，检查字段和索引...`);
      
      const existingColumns = await getTableColumns(connection, tableName);
      const existingIndexes = await getTableIndexes(connection, tableName);
      
      // 添加缺失的字段
      const addedFields = await addMissingColumns(connection, tableName, fields, existingColumns);
      
      // 添加缺失的索引
      const addedIndexes = await addMissingIndexes(connection, tableName, indexes, existingIndexes);
      
      if (addedFields.length === 0 && addedIndexes.length === 0) {
        console.log(`  ✅ 表结构完整，无需更新`);
        return { success: true, action: 'checked', tableName };
      } else {
        console.log(`  ✅ 表结构已更新`);
        return { success: true, action: 'updated', tableName, addedFields, addedIndexes };
      }
    }
  } catch (err) {
    console.error(`  ❌ 处理文件失败:`, err.message);
    return { success: false, reason: err.message };
  }
}

// 主函数
async function initDatabase() {
  let connection;
  
  try {
    console.log('🚀 开始初始化数据库...\n');
    console.log(`📊 数据库配置:`);
    console.log(`   主机: ${dbConfig.host}:${dbConfig.port}`);
    console.log(`   数据库: ${dbConfig.database}`);
    console.log(`   用户: ${dbConfig.user}\n`);
    
    // 连接数据库
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功\n');
    
    // 获取SQL文件目录
    const sqlDir = path.join(__dirname);
    const results = [];
    
    // 处理每个SQL文件
    for (const sqlFile of sqlFiles) {
      const sqlFilePath = path.join(sqlDir, sqlFile);
      
      // 检查文件是否存在
      try {
        await fs.access(sqlFilePath);
      } catch (err) {
        console.log(`⚠️  文件不存在: ${sqlFile}，跳过`);
        continue;
      }
      
      const result = await processSQLFile(connection, sqlFilePath);
      results.push({ file: sqlFile, ...result });
    }
    
    // 输出总结
    console.log('\n' + '='.repeat(50));
    console.log('📊 执行总结:');
    console.log('='.repeat(50));
    
    const created = results.filter(r => r.action === 'created');
    const updated = results.filter(r => r.action === 'updated');
    const checked = results.filter(r => r.action === 'checked');
    const failed = results.filter(r => !r.success);
    
    if (created.length > 0) {
      console.log(`\n✅ 新建表 (${created.length}):`);
      created.forEach(r => console.log(`   - ${r.tableName}`));
    }
    
    if (updated.length > 0) {
      console.log(`\n🔄 更新表 (${updated.length}):`);
      updated.forEach(r => {
        console.log(`   - ${r.tableName}`);
        if (r.addedFields && r.addedFields.length > 0) {
          console.log(`     新增字段: ${r.addedFields.join(', ')}`);
        }
        if (r.addedIndexes && r.addedIndexes.length > 0) {
          console.log(`     新增索引: ${r.addedIndexes.join(', ')}`);
        }
      });
    }
    
    if (checked.length > 0) {
      console.log(`\n✓ 检查通过 (${checked.length}):`);
      checked.forEach(r => console.log(`   - ${r.tableName}`));
    }
    
    if (failed.length > 0) {
      console.log(`\n❌ 失败 (${failed.length}):`);
      failed.forEach(r => console.log(`   - ${r.file}: ${r.reason}`));
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('✨ 数据库初始化完成！\n');
    
  } catch (err) {
    console.error('\n❌ 数据库初始化失败:', err.message);
    console.error('错误详情:', err);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('✅ 数据库连接已关闭');
    }
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  initDatabase().catch(err => {
    console.error('致命错误:', err);
    process.exit(1);
  });
}

module.exports = { initDatabase };




