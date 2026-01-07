# Node.js 项目

一个基于 Express 的全栈 Web 应用，包含用户管理、聊天室、AI对话、日记本、网址导航等功能。

## 📋 项目功能

- 🔐 用户认证系统（登录/注册）
- 💬 实时聊天室
- 🤖 AI智能对话（基于豆包AI）
- 📔 个人日记本
- 🔖 网址导航
- 🎬 抖音弹幕监听
- 🎯 减肥倒计时
- 🎮 解压小游戏
- 🧠 心理学测试
- 🛠️ 各种实用工具

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置数据库

编辑 `api/db.js` 文件，修改数据库连接配置：

```javascript
const dbConfig = {
  host: 'localhost',      // MySQL 主机地址
  port: 3306,             // MySQL 端口
  user: 'root',           // MySQL 用户名
  password: '199808',     // MySQL 密码
  database: 'xl'          // 数据库名称
};
```

**注意**：确保 MySQL 服务已启动，并且数据库 `xl` 已创建。

### 3. 配置 AI API（可选）

如果需要使用 AI 聊天功能，需要配置豆包 API：

**方式一：环境变量（推荐）**
```bash
# Windows PowerShell
$env:DOUBAO_API_KEY="your-api-key-here"

# Windows CMD
set DOUBAO_API_KEY=your-api-key-here

# Linux/Mac
export DOUBAO_API_KEY=your-api-key-here
```

**方式二：直接修改配置文件**
编辑 `aiUtils/config.js` 文件，修改 `DOUBAO_API_KEY` 的值。

### 4. 启动项目

```bash
npm start
```

或者直接使用 Node.js：

```bash
node app.js
```

### 5. 访问应用

启动成功后，你会看到类似以下输出：

```
Server listening on http://localhost:3000
🌐 局域网访问地址: http://192.168.x.x:3000
   其他设备可通过此地址访问
✅ 豆包AI API密钥已配置，AI聊天功能可用
```

然后在浏览器中访问：
- **本地访问**：http://localhost:3000
- **局域网访问**：http://你的IP地址:3000

## 📁 项目结构

```
node/
├── api/              # API 路由模块
│   ├── auth.js      # 认证相关
│   ├── user.js      # 用户管理
│   ├── chat.js      # 聊天室
│   ├── diaries.js   # 日记
│   ├── bookmarks.js # 网址导航
│   └── db.js        # 数据库配置
├── aiUtils/         # AI 工具
│   ├── config.js    # AI 配置
│   └── doubao.js    # 豆包AI实现
├── database/        # 数据库脚本
├── public/          # 前端页面
│   ├── index.html  # 首页
│   ├── login.html   # 登录页
│   └── ...          # 其他页面
├── app.js           # 主应用文件
└── package.json     # 项目配置
```

## 🔧 环境要求

- Node.js >= 14.0.0
- MySQL >= 5.7
- npm 或 yarn

## 📝 注意事项

1. **数据库配置**：确保 MySQL 服务运行正常，数据库已创建
2. **端口占用**：默认使用 3000 端口，如果被占用请修改 `app.js` 中的 `port` 变量
3. **AI 功能**：AI 聊天功能需要配置豆包 API 密钥，否则无法使用
4. **登录保护**：大部分页面需要登录后才能访问，请先注册/登录

## 🐛 常见问题

### 数据库连接失败
- 检查 MySQL 服务是否启动
- 确认数据库配置信息是否正确
- 确认数据库 `xl` 是否存在

### 端口被占用
- 修改 `app.js` 中的 `port` 变量为其他端口（如 3001）
- 或关闭占用 3000 端口的其他程序

### AI 功能无法使用
- 检查是否配置了豆包 API 密钥
- 查看控制台是否有相关错误信息

## 📄 许可证

MIT License
