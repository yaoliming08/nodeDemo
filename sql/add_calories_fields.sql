-- 为weight_records表添加卡路里相关字段
-- 执行此SQL前请先备份数据库

ALTER TABLE `weight_records` 
ADD COLUMN `food_photos` TEXT DEFAULT NULL COMMENT '食物照片文件路径（JSON数组格式，存储多个照片路径）' AFTER `photos`,
ADD COLUMN `calories` DECIMAL(8,2) DEFAULT NULL COMMENT '当日总卡路里（大卡）' AFTER `food_photos`,
ADD COLUMN `calories_analysis` TEXT DEFAULT NULL COMMENT 'AI分析的卡路里详情（JSON格式）' AFTER `calories`;






