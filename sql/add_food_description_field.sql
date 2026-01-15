-- 为weight_records表的calories_analysis添加food_description支持
-- 注意：food_description将保存在calories_analysis的JSON数据中，不需要单独的字段
-- 此SQL文件仅作为说明，实际实现中food_description会保存在calories_analysis JSON中

-- 如果需要单独存储food_description字段，可以执行以下SQL：
-- ALTER TABLE `weight_records` 
-- ADD COLUMN `food_description` TEXT DEFAULT NULL COMMENT '食物描述信息' AFTER `calories_analysis`;

-- 但考虑到food_description是针对每次上传的描述，更适合保存在calories_analysis JSON中
-- 每个分析项可以包含：photo, foods, calories, description, timestamp




