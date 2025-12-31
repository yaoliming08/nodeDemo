-- 为user表添加user_id字段
-- 方案：添加一个自增的user_id字段作为主键

-- 检查user_id字段是否已存在，如果不存在则添加
ALTER TABLE `user` 
ADD COLUMN IF NOT EXISTS `user_id` BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT FIRST,
ADD PRIMARY KEY (`user_id`);

-- 如果上面的语句不支持IF NOT EXISTS，使用下面的方式：
-- 先检查字段是否存在，如果不存在再添加
-- ALTER TABLE `user` ADD COLUMN `user_id` BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT FIRST;
-- ALTER TABLE `user` ADD PRIMARY KEY (`user_id`);

-- 为现有数据生成user_id（如果字段已存在但数据为空）
-- UPDATE `user` SET `user_id` = `user` WHERE `user_id` IS NULL OR `user_id` = 0;





