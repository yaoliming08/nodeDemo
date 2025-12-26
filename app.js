const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');

// 引入路由模块
const authRoutes = require('./api/auth');
const userRoutes = require('./api/user');
const audioRoutes = require('./api/audio');
const testRoutes = require('./api/test');
const toolsRoutes = require('./api/tools');
const bookmarksRoutes = require('./api/bookmarks');
const diariesRoutes = require('./api/diaries');

const app = express();
const port = 3000;

app.use(express.json());
app.use(cookieParser());

// 配置会话管理
app.use(session({
  secret: 'your-secret-key-change-this-in-production', // 生产环境请修改为随机字符串
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // 如果使用 HTTPS，设置为 true
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24小时
  }
}));

// 路由保护中间件 - 检查用户是否已登录
function requireAuth(req, res, next) {
  if (req.session && req.session.isAuthenticated) {
    return next();
  } else {
    // 如果是 API 请求，返回 JSON 错误
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ error: '未登录，请先登录' });
    }
    // 如果是页面请求，重定向到登录页
    return res.redirect('/login.html');
  }
}

// 保护需要登录的页面（在静态文件服务之前）
app.use((req, res, next) => {
  // 排除静态资源文件（CSS、JS、图片等）
  const staticExtensions = ['.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.json'];
  const isStaticFile = staticExtensions.some(ext => req.path.toLowerCase().endsWith(ext));
  
  if (isStaticFile) {
    return next();
  }
  
  // 排除登录页、注册页和 API 中的登录相关接口
  if (req.path === '/login.html' || 
      req.path === '/register.html' ||
      req.path.startsWith('/api/login') || 
      req.path.startsWith('/api/register') ||
      req.path.startsWith('/api/check-auth')) {
    return next();
  }
  
  // 保护 HTML 页面和根路径
  if (req.path.endsWith('.html') || req.path === '/' || req.path === '/index.html') {
    return requireAuth(req, res, next);
  }
  
  // API 路由需要单独保护（除了登录和注册相关）
  if (req.path.startsWith('/api/') && 
      !req.path.startsWith('/api/login') && 
      !req.path.startsWith('/api/register') &&
      !req.path.startsWith('/api/check-auth')) {
    return requireAuth(req, res, next);
  }
  
  next();
});

// 允许访问静态文件（HTML页面）
app.use(express.static('public'));

// 注册路由
app.use('/api', authRoutes);      // 登录注册相关：/api/login, /api/register, /api/logout, /api/check-auth
app.use('/api', audioRoutes);     // 音频相关：/api/audio/:filename
app.use('/api', testRoutes);      // 测试相关：/api/personality-test, /api/mental-health-test
app.use('/api', toolsRoutes);     // 工具类：/api/crawl, /api/ai-chat, /api/identify-product, /api/search-prices
app.use('/api', bookmarksRoutes); // 网址导航：/api/bookmarks
app.use('/api', diariesRoutes);    // 日记：/api/diaries
app.use('/', userRoutes);         // 用户管理：/users, /users/search, /seed-users

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
  // 检查API密钥
  const { DOUBAO_API_KEY } = require('./aiUtils/config');
  if (!DOUBAO_API_KEY || DOUBAO_API_KEY === '') {
    console.log('⚠️  警告: 未配置豆包API密钥，AI聊天功能将无法使用');
    console.log('   请设置环境变量 DOUBAO_API_KEY，或修改 aiUtils/config.js 中的配置');
    console.log('   获取API Key: https://www.volcengine.com/product/doubao');
  } else {
    console.log('✅ 豆包AI API密钥已配置，AI聊天功能可用');
  }
});
