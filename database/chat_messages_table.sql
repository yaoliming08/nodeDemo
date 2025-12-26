-- 聊天室消息表设计
-- 表名: chat_messages (聊天消息)
-- 功能: 存储所有用户的聊天消息（群聊）

CREATE TABLE IF NOT EXISTS `chat_messages` (
  `id` INT(11) NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `user_id` BIGINT(20) UNSIGNED NOT NULL COMMENT '发送者用户ID，关联user表的user_id',
  `username` VARCHAR(50) NOT NULL COMMENT '发送者用户名（冗余字段，方便查询）',
  `message` TEXT NOT NULL COMMENT '消息内容',
  `message_type` VARCHAR(20) DEFAULT 'text' COMMENT '消息类型：text(文本)、image(图片)、file(文件)',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '发送时间',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_user_created` (`user_id`, `created_at`),
  CONSTRAINT `fk_chat_messages_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='聊天室消息表';

-- 索引说明：
-- idx_user_id: 用于快速查询某个用户发送的消息
-- idx_created_at: 用于按时间排序查询
-- idx_user_created: 用于查询某个用户在特定时间的消息（复合索引）

-- 外键说明：
-- fk_chat_messages_user: 关联user表的user_id字段（主键）
-- ON DELETE CASCADE: 当用户被删除时，该用户发送的所有消息也会被自动删除
-- ON UPDATE CASCADE: 当用户user_id更新时，消息的user_id也会自动更新

