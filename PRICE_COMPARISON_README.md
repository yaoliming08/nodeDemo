# 商品比价工具说明

## 功能概述

商品比价工具可以：
1. 上传商品图片
2. 使用AI识别商品信息
3. 查询拼多多、淘宝、京东的价格
4. 显示最高价和最低价对比

## 当前实现状态

### ✅ 已实现
- 图片上传功能
- 商品识别（使用豆包AI多模态能力）
- 前端界面和结果展示
- 价格统计和排序

### ⚠️ 需要完善
- **价格查询功能目前使用模拟数据**

由于电商平台（淘宝、京东、拼多多）都有严格的反爬虫机制，直接爬取价格数据比较困难。当前实现返回的是模拟数据作为演示。

## 实现真实价格查询的方案

### 方案一：使用第三方比价API（推荐）
1. **比价网API**
   - 一些第三方服务提供商品比价API
   - 需要注册并获取API密钥
   - 通常按调用次数收费

2. **商品比价服务**
   - 搜索"商品比价API"或"价格查询API"
   - 选择可靠的服务商

### 方案二：使用爬虫框架
1. **Puppeteer**（推荐）
   ```bash
   npm install puppeteer
   ```
   - 可以模拟真实浏览器访问
   - 绕过部分反爬虫机制
   - 需要处理验证码、登录等问题

2. **Playwright**
   - 类似Puppeteer，功能更强大
   - 支持多浏览器

### 方案三：使用电商平台开放API
- 淘宝开放平台：https://open.taobao.com/
- 京东开放平台：https://open.jd.com/
- 拼多多开放平台：https://open.pinduoduo.com/
- 需要申请开发者账号和API权限

## 代码修改位置

在 `app.js` 中找到 `searchPricesFromPlatforms` 函数，替换为真实的API调用：

```javascript
async function searchPricesFromPlatforms(keywords) {
  // 替换这里的模拟数据为真实API调用
  
  // 示例：使用Puppeteer爬取
  // const browser = await puppeteer.launch();
  // const page = await browser.newPage();
  // await page.goto(`https://s.taobao.com/search?q=${encodeURIComponent(keywords)}`);
  // ... 解析页面获取价格
  
  // 或使用第三方API
  // const response = await axios.get('https://api.example.com/search', {
  //   params: { keywords }
  // });
  // return response.data;
}
```

## 注意事项

1. **法律合规**
   - 确保爬虫行为符合网站服务条款
   - 遵守robots.txt规则
   - 不要过度频繁请求

2. **技术挑战**
   - 反爬虫机制（验证码、IP封禁等）
   - 页面结构变化需要更新解析逻辑
   - 需要处理动态加载的内容

3. **性能考虑**
   - 爬取多个平台需要较长时间
   - 建议使用异步并发处理
   - 考虑添加缓存机制

## 测试

当前版本可以测试：
1. 图片上传功能
2. 商品识别功能（需要豆包AI密钥）
3. 界面展示效果

价格数据为模拟数据，用于演示界面效果。

## 后续优化建议

1. 添加价格历史记录
2. 支持价格趋势图表
3. 添加商品收藏功能
4. 支持多商品对比
5. 添加价格提醒功能

