# 数据库表设计说明

## bookmarks 表 - 网址导航表

### 表结构

| 字段名 | 类型 | 长度 | 是否为空 | 默认值 | 说明 |
|--------|------|------|----------|--------|------|
| id | INT | 11 | NOT NULL | AUTO_INCREMENT | 主键ID |
| user_id | BIGINT(20) UNSIGNED | - | NOT NULL | - | 用户ID，关联user表的user字段 |
| title | VARCHAR | 100 | NOT NULL | - | 网址标题/名称 |
| url | VARCHAR | 500 | NOT NULL | - | 网址链接 |
| icon | VARCHAR | 255 | NULL | NULL | 图标URL或图标名称 |
| description | VARCHAR | 255 | NULL | NULL | 网址描述 |
| category | VARCHAR | 50 | NULL | '默认' | 分类名称（如：工作、学习、娱乐等） |
| sort_order | INT | 11 | NULL | 0 | 排序顺序，数字越小越靠前 |
| created_at | DATETIME | - | NULL | CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME | - | NULL | CURRENT_TIMESTAMP | 更新时间（自动更新） |

### 索引

- **PRIMARY KEY**: `id` - 主键索引
- **KEY**: `idx_user_id` - 用户ID索引，用于快速查询某个用户的所有书签
- **KEY**: `idx_category` - 分类索引，用于按分类查询
- **KEY**: `idx_sort_order` - 排序索引，用于排序查询

### 外键约束

- **fk_bookmarks_user**: `user_id` 关联 `user.user_id`（主键）
  - ON DELETE CASCADE: 当用户被删除时，该用户的所有书签也会被自动删除
  - ON UPDATE CASCADE: 当用户user_id更新时，书签的user_id也会自动更新

### 字段详细说明

1. **id**: 主键，自增，唯一标识每条记录
2. **user_id**: 关联到user表，确保每个用户只能看到和管理自己的书签
3. **title**: 网址显示的名称，如"百度"、"GitHub"等
4. **url**: 完整的网址链接，支持http/https协议
5. **icon**: 图标，可以是：
   - 图标URL（如：https://www.baidu.com/favicon.ico）
   - 图标名称（如：baidu、github等，前端使用图标库）
   - Base64编码的图片
6. **description**: 网址的简短描述，帮助用户识别
7. **category**: 分类，用于将书签分组显示，如：
   - 工作
   - 学习
   - 娱乐
   - 工具
   - 默认（未分类）
8. **sort_order**: 排序字段，用户可以自定义排序，数字越小越靠前
9. **created_at**: 记录创建时间，自动设置
10. **updated_at**: 记录更新时间，每次更新时自动更新

### 使用场景

1. **查询用户的所有书签**: `SELECT * FROM bookmarks WHERE user_id = ? ORDER BY sort_order ASC, created_at DESC`
2. **按分类查询**: `SELECT * FROM bookmarks WHERE user_id = ? AND category = ? ORDER BY sort_order ASC`
3. **添加书签**: `INSERT INTO bookmarks (user_id, title, url, icon, description, category, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)`
4. **更新书签**: `UPDATE bookmarks SET title=?, url=?, icon=?, description=?, category=?, sort_order=? WHERE id=? AND user_id=?`
5. **删除书签**: `DELETE FROM bookmarks WHERE id=? AND user_id=?`

### 注意事项

1. 每个用户只能管理自己的书签（通过user_id验证）
2. 删除用户时，该用户的所有书签会自动删除（CASCADE）
3. url字段长度500字符，足够存储大多数网址
4. sort_order默认值为0，新增书签时如果不指定，会排在最后
5. category字段有默认值"默认"，方便未分类的书签显示

