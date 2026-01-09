-- 更新weight_records表的字段类型
-- 将DECIMAL(5,2)改为DECIMAL(6,2)，支持更大的体重值（最大9999.99斤）

ALTER TABLE `weight_records` 
MODIFY COLUMN `weight` DECIMAL(6,2) NOT NULL COMMENT '当日体重（斤）',
MODIFY COLUMN `initial_weight` DECIMAL(6,2) NOT NULL COMMENT '初始体重（斤）',
MODIFY COLUMN `target_weight` DECIMAL(6,2) NOT NULL COMMENT '目标体重（斤）',
MODIFY COLUMN `target_loss` DECIMAL(6,2) NOT NULL COMMENT '目标减重（斤）',
MODIFY COLUMN `lost_weight` DECIMAL(6,2) NOT NULL DEFAULT 0.00 COMMENT '已减体重（斤）',
MODIFY COLUMN `remaining_weight` DECIMAL(6,2) NOT NULL DEFAULT 0.00 COMMENT '待减体重（斤）';




