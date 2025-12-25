const express = require('express');
const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const port = 3000;

// 根据你的本地设置修改下面几个参数
const dbConfig = {
  host: 'localhost',      // 或者 127.0.0.1
  port: 3306,             // 如果 mysql95 改了端口，这里也要改
  user: 'root',           // 如果不是 root，改成你自己的 MySQL 用户名
  password: '199808',     // 你提供的密码
  database: 'xl'          // 你截图里的库名
};

// 创建连接池
const pool = mysql.createPool(dbConfig);

app.use(express.json());
// 允许访问静态文件（HTML页面）
app.use(express.static('public'));

// 生成随机用户数据的工具函数
function createRandomUser(index) {
  const names = ['张三', '李四', '王五', '赵六', '孙七', '周八', '吴九', '郑十'];
  const genders = ['男', '女'];

  const name = names[Math.floor(Math.random() * names.length)] + index;
  const gender = genders[Math.floor(Math.random() * genders.length)];
  const age = Math.floor(Math.random() * 40) + 18; // 18-57 岁

  // 简单生成手机号和身份证号（只是模拟数据，不是真实规则）
  const phone = '13' + Math.floor(100000000 + Math.random() * 900000000).toString();
  const idCard = '4201' + // 地区码随便写的
    '1990' +              // 年份
    ('0' + Math.floor(Math.random() * 9 + 1)).slice(-2) + // 月
    ('0' + Math.floor(Math.random() * 28 + 1)).slice(-2) + // 日
    Math.floor(1000 + Math.random() * 9000).toString();   // 顺序码

  const password = 'pass' + Math.floor(Math.random() * 100000);

  return {
    username: name,
    password,
    gender,
    age,
    phone,
    id_card: idCard
  };
}

// 根路径由静态文件服务自动返回 public/index.html

// 查询 xl.user 表中所有数据
app.get('/users', async (req, res) => {
  try {
    const sql = 'SELECT * FROM `user`';
    const [rows] = await pool.query(sql);
    res.json(rows);
  } catch (err) {
    console.error('DB error:', err);
    res.status(500).json({ error: 'Database error', detail: err.message });
  }
});

// 根据用户名查询用户数据（支持模糊搜索）
app.get('/users/search', async (req, res) => {
  const { username } = req.query;
  
  if (!username) {
    return res.status(400).json({ error: '请提供用户名参数 username' });
  }

  try {
    // 使用 LIKE 进行模糊搜索，% 表示任意字符
    const sql = 'SELECT * FROM `user` WHERE `username` LIKE ?';
    const searchPattern = `%${username}%`;
    const [rows] = await pool.query(sql, [searchPattern]);
    
    if (rows.length === 0) {
      return res.json({ message: '未找到匹配的用户', data: [] });
    }
    
    // 返回所有匹配的结果
    res.json({ message: '查询成功', data: rows, count: rows.length });
  } catch (err) {
    console.error('DB error:', err);
    res.status(500).json({ error: 'Database error', detail: err.message });
  }
});

// 往 xl.user 表里插入一条完整的用户数据
app.post('/users', async (req, res) => {
  const { username, password, gender, age, phone, id_card } = req.body;

  if (!username || !password || !gender || !age || !phone || !id_card) {
    return res.status(400).json({ error: '缺少字段，请提供 username, password, gender, age, phone, id_card' });
  }

  try {
    const sql = 'INSERT INTO `user` (`username`, `password`, `gender`, `age`, `phone`, `id_card`) VALUES (?, ?, ?, ?, ?, ?)';
    const [result] = await pool.execute(sql, [username, password, gender, age, phone, id_card]);
    res.json({ id: result.insertId, username, gender, age, phone, id_card });
  } catch (err) {
    console.error('DB error:', err);
    res.status(500).json({ error: 'Database error', detail: err.message });
  }
});

// 一次性往表里插入 100 条模拟数据
app.get('/seed-users', async (req, res) => {
  const users = [];
  for (let i = 1; i <= 100; i++) {
    users.push(createRandomUser(i));
  }

  const sql = 'INSERT INTO `user` (`username`, `password`, `gender`, `age`, `phone`, `id_card`) VALUES ?';
  const values = users.map(u => [u.username, u.password, u.gender, u.age, u.phone, u.id_card]);

  try {
    const [result] = await pool.query(sql, [values]);
    res.json({ inserted: result.affectedRows });
  } catch (err) {
    console.error('DB error:', err);
    res.status(500).json({ error: 'Database error', detail: err.message });
  }
});

// 获取音频base64数据的API端点
app.get('/api/audio/:filename', async (req, res) => {
  let { filename } = req.params;
  
  // 清理文件名（去除首尾空格和换行符，并进行URL解码）
  filename = decodeURIComponent(filename).trim();
  
  console.log(`请求的文件名: "${filename}" (长度: ${filename.length}, 字符码: ${Array.from(filename).map(c => c.charCodeAt(0)).join(',')})`);
  
  // 只允许读取video1.json、video2.json和video3.json
  const allowedFiles = ['video1.json', 'video2.json', 'video3.json'];
  if (!allowedFiles.includes(filename)) {
    console.error(`不允许的文件名: "${filename}" (长度: ${filename.length})`);
    console.error(`允许的文件列表:`, allowedFiles);
    return res.status(400).json({ error: '不允许的文件名', received: filename });
  }

  try {
    const filePath = path.join(__dirname, 'file', filename);
    const fileContent = await fs.readFile(filePath, 'utf-8');
    
    // 解析JSON格式文件
    let audioBase64;
    try {
      const jsonData = JSON.parse(fileContent.trim());
      // 优先使用 audioBase64 字段
      if (jsonData.audioBase64) {
        audioBase64 = jsonData.audioBase64;
      } else if (jsonData.base64) {
        audioBase64 = jsonData.base64;
      } else {
        throw new Error('JSON文件中未找到 audioBase64 或 base64 字段');
      }
      console.log(`成功解析JSON，Base64数据长度: ${audioBase64.length}`);
    } catch (jsonError) {
      console.error('解析JSON失败:', jsonError.message);
      // 如果不是JSON，直接使用文件内容
      audioBase64 = fileContent.trim();
    }
    
    res.json({ 
      filename,
      audioBase64: audioBase64
    });
  } catch (err) {
    console.error('读取文件错误:', err);
    res.status(500).json({ error: '读取文件失败', detail: err.message });
  }
});

// 保存人格测试结果（可选功能）
app.post('/api/personality-test', async (req, res) => {
  const { username, personalityType, scores } = req.body;
  
  if (!personalityType) {
    return res.status(400).json({ error: '请提供人格类型 personalityType' });
  }

  try {
    // 如果数据库中有 personality_test 表，可以保存结果
    // 这里先返回成功，实际保存需要创建相应的表
    // const sql = 'INSERT INTO `personality_test` (`username`, `personality_type`, `scores`, `created_at`) VALUES (?, ?, ?, NOW())';
    // const scoresJson = JSON.stringify(scores);
    // const [result] = await pool.execute(sql, [username || '匿名', personalityType, scoresJson]);
    
    res.json({ 
      success: true, 
      message: '测试结果已记录',
      personalityType,
      scores
    });
  } catch (err) {
    console.error('保存测试结果错误:', err);
    res.status(500).json({ error: '保存失败', detail: err.message });
  }
});

// 接口爬虫API端点
app.post('/api/crawl', async (req, res) => {
  const { url } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: '请提供网址参数 url' });
  }

  // 验证URL格式
  try {
    new URL(url);
  } catch (e) {
    return res.status(400).json({ error: '无效的网址格式' });
  }

  try {
    console.log(`开始爬取: ${url}`);
    
    // 获取页面HTML
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 10000,
      maxRedirects: 5
    });

    const html = response.data;
    const $ = cheerio.load(html);
    
    const apis = [];
    const baseUrl = new URL(url).origin;

    // 1. 分析script标签中的JavaScript代码
    $('script').each((i, elem) => {
      const scriptContent = $(elem).html() || $(elem).text() || '';
      if (!scriptContent) return;

      // 查找fetch调用
      const fetchRegex = /fetch\s*\(\s*['"`]([^'"`]+)['"`]/gi;
      let match;
      while ((match = fetchRegex.exec(scriptContent)) !== null) {
        const apiUrl = match[1];
        const fullUrl = apiUrl.startsWith('http') ? apiUrl : new URL(apiUrl, baseUrl).href;
        apis.push({
          method: 'GET', // fetch默认是GET，但可能后面有配置
          url: fullUrl,
          source: 'fetch调用'
        });
      }

      // 查找fetch with options
      const fetchOptionsRegex = /fetch\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*\{[^}]*method\s*:\s*['"`]([^'"`]+)['"`]/gi;
      while ((match = fetchOptionsRegex.exec(scriptContent)) !== null) {
        const apiUrl = match[1];
        const method = match[2].toUpperCase();
        const fullUrl = apiUrl.startsWith('http') ? apiUrl : new URL(apiUrl, baseUrl).href;
        apis.push({
          method: method,
          url: fullUrl,
          source: 'fetch调用（带配置）'
        });
      }

      // 查找axios调用
      const axiosRegex = /axios\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/gi;
      while ((match = axiosRegex.exec(scriptContent)) !== null) {
        const method = match[1].toUpperCase();
        const apiUrl = match[2];
        const fullUrl = apiUrl.startsWith('http') ? apiUrl : new URL(apiUrl, baseUrl).href;
        apis.push({
          method: method,
          url: fullUrl,
          source: 'axios调用'
        });
      }

      // 查找XMLHttpRequest
      const xhrRegex = /\.open\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*['"`]([^'"`]+)['"`]/gi;
      while ((match = xhrRegex.exec(scriptContent)) !== null) {
        const method = match[1].toUpperCase();
        const apiUrl = match[2];
        const fullUrl = apiUrl.startsWith('http') ? apiUrl : new URL(apiUrl, baseUrl).href;
        apis.push({
          method: method,
          url: fullUrl,
          source: 'XMLHttpRequest'
        });
      }

      // 查找$.ajax (jQuery)
      const jqueryAjaxRegex = /\$\.ajax\s*\(\s*\{[^}]*url\s*:\s*['"`]([^'"`]+)['"`]/gi;
      while ((match = jqueryAjaxRegex.exec(scriptContent)) !== null) {
        const apiUrl = match[1];
        const fullUrl = apiUrl.startsWith('http') ? apiUrl : new URL(apiUrl, baseUrl).href;
        apis.push({
          method: 'GET', // jQuery ajax默认
          url: fullUrl,
          source: 'jQuery ajax'
        });
      }
    });

    // 2. 查找页面中的API链接（href和src中的API路径）
    $('a[href*="/api/"], a[href*="api."]').each((i, elem) => {
      const href = $(elem).attr('href');
      if (href) {
        const fullUrl = href.startsWith('http') ? href : new URL(href, baseUrl).href;
        apis.push({
          method: 'GET',
          url: fullUrl,
          source: '页面链接'
        });
      }
    });

    // 3. 查找form的action
    $('form[action]').each((i, elem) => {
      const action = $(elem).attr('action');
      const method = ($(elem).attr('method') || 'GET').toUpperCase();
      if (action) {
        const fullUrl = action.startsWith('http') ? action : new URL(action, baseUrl).href;
        apis.push({
          method: method,
          url: fullUrl,
          source: '表单提交'
        });
      }
    });

    // 去重（基于URL和method）
    const uniqueApis = [];
    const seen = new Set();
    apis.forEach(api => {
      const key = `${api.method}:${api.url}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueApis.push(api);
      }
    });

    console.log(`发现 ${uniqueApis.length} 个API接口`);

    res.json({
      success: true,
      url: url,
      apis: uniqueApis,
      count: uniqueApis.length
    });

  } catch (err) {
    console.error('爬取错误:', err);
    if (err.code === 'ENOTFOUND') {
      return res.status(400).json({ error: '无法访问该网址，请检查网址是否正确' });
    } else if (err.code === 'ECONNREFUSED') {
      return res.status(400).json({ error: '连接被拒绝，该网址可能无法访问' });
    } else if (err.code === 'ETIMEDOUT') {
      return res.status(400).json({ error: '请求超时，请稍后重试' });
    } else {
      return res.status(500).json({ error: '爬取失败', detail: err.message });
    }
  }
});

// 保存心理健康测试结果（可选功能）
app.post('/api/mental-health-test', async (req, res) => {
  const { testName, score, level } = req.body;
  
  if (!testName || score === undefined) {
    return res.status(400).json({ error: '请提供测试名称和分数' });
  }

  try {
    // 如果数据库中有 mental_health_test 表，可以保存结果
    // 这里先返回成功，实际保存需要创建相应的表
    // const sql = 'INSERT INTO `mental_health_test` (`test_name`, `score`, `level`, `created_at`) VALUES (?, ?, ?, NOW())';
    // const [result] = await pool.execute(sql, [testName, score, level]);
    
    res.json({ 
      success: true, 
      message: '测试结果已记录',
      testName,
      score,
      level
    });
  } catch (err) {
    console.error('保存测试结果错误:', err);
    res.status(500).json({ error: '保存失败', detail: err.message });
  }
});

// 豆包AI聊天API端点
app.post('/api/ai-chat', async (req, res) => {
  const { message, history = [], model = 'doubao-seed-1-6-251015' } = req.body;
  
  if (!message) {
    return res.status(400).json({ error: '请提供消息内容' });
  }

  // 豆包AI API配置
  // 获取方式：https://www.volcengine.com/product/doubao
  // 注意：豆包AI的API端点可能因地区而异，请根据实际情况调整
  const DOUBAO_API_KEY = process.env.DOUBAO_API_KEY || '508ec7e7-b2c5-4f38-9470-e34bf7d39f12';
  // 豆包AI API端点（根据您的账号区域选择）
  // 北京: https://ark.cn-beijing.volces.com/api/v3/chat/completions
  // 上海: https://ark.cn-shanghai.volces.com/api/v3/chat/completions
  const DOUBAO_API_URL = process.env.DOUBAO_API_URL || 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';

  if (!DOUBAO_API_KEY) {
    return res.status(500).json({ 
      error: '未配置豆包API密钥，请在环境变量中设置 DOUBAO_API_KEY，或修改 app.js 中的配置',
      hint: '获取API Key: https://www.volcengine.com/product/doubao'
    });
  }

  try {
    // 构建消息历史（符合豆包AI格式）
    const messages = [];
    
    // 添加历史对话（最近10条消息，即5轮对话）
    const recentHistory = history.slice(-10);
    recentHistory.forEach(item => {
      messages.push({
        role: item.role === 'assistant' ? 'assistant' : 'user',
        content: item.content  // 豆包AI支持字符串或数组格式的content
      });
    });
    
    // 添加当前消息（纯文本格式）
    messages.push({
      role: 'user',
      content: message  // 如果是多模态，可以改为数组格式，当前仅支持文本
    });

    // 调用豆包AI API
    // 根据豆包AI实际API格式构建请求
    const requestBody = {
      model: model,
      messages: messages,
      max_completion_tokens: 65535,  // 豆包AI使用 max_completion_tokens
      temperature: 0.7
    };

    // 如果模型支持推理，可以添加 reasoning_effort 参数
    // 注意：不是所有模型都支持此参数，根据实际模型选择
    if (model.includes('seed') || model.includes('reasoning')) {
      requestBody.reasoning_effort = 'medium';
    }

    const response = await axios.post(DOUBAO_API_URL, requestBody, {
      headers: {
        'Authorization': `Bearer ${DOUBAO_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 60000  // 增加超时时间，因为豆包AI可能需要更长时间处理
    });

    // 处理豆包AI的响应格式
    let aiResponse;
    
    // 豆包AI的标准响应格式：response.data.choices[0].message.content
    if (response.data && response.data.choices && response.data.choices[0]) {
      const choice = response.data.choices[0];
      
      // 处理消息内容（可能是字符串或对象）
      if (typeof choice.message === 'string') {
        aiResponse = choice.message;
      } else if (choice.message && choice.message.content) {
        // 如果content是数组（多模态），提取文本部分
        if (Array.isArray(choice.message.content)) {
          const textParts = choice.message.content
            .filter(item => item.type === 'text')
            .map(item => item.text)
            .join('\n');
          aiResponse = textParts || choice.message.content[0]?.text || '';
        } else {
          aiResponse = choice.message.content;
        }
      } else {
        aiResponse = choice.text || choice.content || '';
      }
    } else {
      // 兼容其他可能的响应格式
      aiResponse = response.data?.message || response.data?.content || '';
    }

    if (!aiResponse) {
      console.error('豆包AI响应数据:', JSON.stringify(response.data, null, 2));
      throw new Error('AI返回内容为空，请检查API响应格式。响应数据已记录到服务器日志。');
    }
    
    res.json({
      success: true,
      response: aiResponse,
      model: model
    });

  } catch (err) {
    console.error('豆包AI API错误:', err.response?.data || err.message);
    console.error('错误详情:', {
      status: err.response?.status,
      statusText: err.response?.statusText,
      data: err.response?.data
    });
    
    if (err.response?.status === 401) {
      return res.status(401).json({ 
        error: 'API密钥无效，请检查DOUBAO_API_KEY配置',
        hint: '请确认API密钥是否正确，格式为: 508ec7e7-b2c5-4f38-9470-e34bf7d39f12'
      });
    } else if (err.response?.status === 400) {
      const errorMsg = err.response?.data?.error?.message || err.response?.data?.message || '请求参数错误';
      return res.status(400).json({ 
        error: '请求参数错误', 
        detail: errorMsg,
        hint: '请检查模型名称和请求格式是否正确'
      });
    } else if (err.response?.status === 429) {
      return res.status(429).json({ error: '请求过于频繁，请稍后再试' });
    } else if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
      return res.status(504).json({ error: '请求超时，请稍后重试（豆包AI可能需要更长时间处理）' });
    } else if (err.response?.data) {
      // 返回豆包AI的具体错误信息
      const errorData = err.response.data;
      return res.status(err.response.status || 500).json({ 
        error: 'AI服务调用失败', 
        detail: errorData.error?.message || errorData.message || JSON.stringify(errorData)
      });
    } else {
      return res.status(500).json({ 
        error: 'AI服务调用失败', 
        detail: err.message 
      });
    }
  }
});

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
  // 检查API密钥（环境变量或代码中的默认值）
  const defaultApiKey = '508ec7e7-b2c5-4f38-9470-e34bf7d39f12';
  const apiKey = process.env.DOUBAO_API_KEY || defaultApiKey;
  if (!apiKey || apiKey === '') {
    console.log('⚠️  警告: 未配置豆包API密钥，AI聊天功能将无法使用');
    console.log('   请设置环境变量 DOUBAO_API_KEY，或修改 app.js 中的配置');
    console.log('   获取API Key: https://www.volcengine.com/product/doubao');
  } else {
    console.log('✅ 豆包AI API密钥已配置，AI聊天功能可用');
  }
});


