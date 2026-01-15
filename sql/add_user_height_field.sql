-- 为user表添加height字段（身高，单位：厘米）
-- 如果字段已存在则跳过

ALTER TABLE `user` 
ADD COLUMN IF NOT EXISTS `height` DECIMAL(5,2) DEFAULT NULL COMMENT '身高（厘米）' AFTER `age`;






