-- 减肥记录表设计
-- 表名: weight_records (减肥记录)
-- 功能: 存储每个用户每天的减肥数据，包括体重、照片等

CREATE TABLE IF NOT EXISTS `weight_records` (
  `id` INT(11) NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `user_id` BIGINT(20) UNSIGNED NOT NULL COMMENT '用户ID，关联user表的user_id',
  `record_date` DATE NOT NULL COMMENT '记录日期',
  `weight` DECIMAL(6,2) NOT NULL COMMENT '当日体重（斤）',
  `initial_weight` DECIMAL(6,2) NOT NULL COMMENT '初始体重（斤）',
  `target_weight` DECIMAL(6,2) NOT NULL COMMENT '目标体重（斤）',
  `target_loss` DECIMAL(6,2) NOT NULL COMMENT '目标减重（斤）',
  `lost_weight` DECIMAL(6,2) NOT NULL DEFAULT 0.00 COMMENT '已减体重（斤）',
  `remaining_weight` DECIMAL(6,2) NOT NULL DEFAULT 0.00 COMMENT '待减体重（斤）',
  `photos` TEXT DEFAULT NULL COMMENT '照片文件路径（JSON数组格式，存储多个照片路径）',
  `notes` TEXT DEFAULT NULL COMMENT '备注信息',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_date` (`user_id`, `record_date`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_record_date` (`record_date`),
  KEY `idx_user_date` (`user_id`, `record_date`),
  CONSTRAINT `fk_weight_records_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户减肥记录表';

