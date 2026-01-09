-- 日记表设计
-- 表名: diaries (日记)
-- 功能: 存储每个用户的日记记录

CREATE TABLE IF NOT EXISTS `diaries` (
  `id` INT(11) NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `user_id` BIGINT(20) UNSIGNED NOT NULL COMMENT '用户ID，关联user表的user_id',
  `title` VARCHAR(200) DEFAULT NULL COMMENT '日记标题（可选）',
  `content` TEXT NOT NULL COMMENT '日记内容',
  `diary_date` DATE NOT NULL COMMENT '日记日期',
  `mood` VARCHAR(20) DEFAULT NULL COMMENT '心情（可选，如：开心、难过、平静等）',
  `weather` VARCHAR(20) DEFAULT NULL COMMENT '天气（可选）',
  `tags` VARCHAR(255) DEFAULT NULL COMMENT '标签（多个标签用逗号分隔）',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_diary_date` (`diary_date`),
  KEY `idx_user_date` (`user_id`, `diary_date`),
  CONSTRAINT `fk_diaries_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户日记表';

-- 索引说明：
-- idx_user_id: 用于快速查询某个用户的所有日记
-- idx_diary_date: 用于按日期查询
-- idx_user_date: 用于查询某个用户在特定日期的日记（复合索引）

-- 外键说明：
-- fk_diaries_user: 关联user表的user_id字段（主键）
-- ON DELETE CASCADE: 当用户被删除时，该用户的所有日记也会被自动删除
-- ON UPDATE CASCADE: 当用户user_id更新时，日记的user_id也会自动更新










