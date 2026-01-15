-- 网址导航表设计
-- 表名: bookmarks (书签/导航)
-- 功能: 存储每个用户的网址导航数据

CREATE TABLE IF NOT EXISTS `bookmarks` (
  `id` INT(11) NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `user_id` BIGINT(20) UNSIGNED NOT NULL COMMENT '用户ID，关联user表的user字段',
  `title` VARCHAR(100) NOT NULL COMMENT '网址标题/名称',
  `url` VARCHAR(500) NOT NULL COMMENT '网址链接',
  `icon` VARCHAR(255) DEFAULT NULL COMMENT '图标URL或图标名称',
  `description` VARCHAR(255) DEFAULT NULL COMMENT '网址描述',
  `category` VARCHAR(50) DEFAULT '默认' COMMENT '分类名称（如：工作、学习、娱乐等）',
  `sort_order` INT(11) DEFAULT 0 COMMENT '排序顺序，数字越小越靠前',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_category` (`category`),
  KEY `idx_sort_order` (`sort_order`),
  CONSTRAINT `fk_bookmarks_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户网址导航表';






