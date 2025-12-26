// 工具类接口
const express = require('express');
const router = express.Router();
const axios = require('axios');
const cheerio = require('cheerio');
const multer = require('multer');
const fs = require('fs').promises;
const { extractKeywords, searchPricesFromPlatforms } = require('./utils');
const { chat: doubaoChat, vision: doubaoVision } = require('../aiUtils/doubao');
const { DOUBAO_API_KEY } = require('../aiUtils/config');

// 配置文件上传
const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// 接口爬虫API端点
router.post('/crawl', async (req, res) => {
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

// 豆包AI聊天API端点
router.post('/ai-chat', async (req, res) => {
  const { message, history = [], model = 'doubao-seed-1-6-251015' } = req.body;
  
  if (!message) {
    return res.status(400).json({ error: '请提供消息内容' });
  }

  if (!DOUBAO_API_KEY) {
    return res.status(500).json({ 
      error: '未配置豆包API密钥，请在环境变量中设置 DOUBAO_API_KEY，或修改 aiUtils/config.js 中的配置',
      hint: '获取API Key: https://www.volcengine.com/product/doubao'
    });
  }

  try {
    const result = await doubaoChat(message, history, model);
    res.json(result);
  } catch (err) {
    // 处理错误
    const statusCode = err.statusCode || 500;
    const errorResponse = {
      error: err.message,
      detail: err.detail || err.message
    };
    
    if (err.hint) {
      errorResponse.hint = err.hint;
    }
    
    res.status(statusCode).json(errorResponse);
  }
});

// 商品识别API（使用豆包AI多模态能力）
router.post('/identify-product', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '请上传图片文件' });
  }

  if (!DOUBAO_API_KEY) {
    // 清理临时文件
    await fs.unlink(req.file.path).catch(() => {});
    return res.status(500).json({ 
      error: '未配置豆包API密钥，请在环境变量中设置 DOUBAO_API_KEY，或修改 aiUtils/config.js 中的配置',
      hint: '获取API Key: https://www.volcengine.com/product/doubao'
    });
  }

  try {
    // 读取图片文件并转换为base64
    const imageBuffer = await fs.readFile(req.file.path);
    const imageBase64 = imageBuffer.toString('base64');
    const imageMimeType = req.file.mimetype;
    const imageDataUrl = `data:${imageMimeType};base64,${imageBase64}`;

    // 调用豆包AI识别商品
    const prompt = '请识别这张图片中的商品，告诉我：1. 商品名称（尽量详细，包含品牌、型号等关键信息）2. 商品类型 3. 3-5个搜索关键词（用逗号分隔）。请用JSON格式返回：{"productName": "商品名称", "category": "商品类型", "keywords": ["关键词1", "关键词2"]}';
    
    const result = await doubaoVision(imageDataUrl, prompt, 'doubao-seed-1-6-251015', {
      maxCompletionTokens: 1000,
      timeout: 30000
    });

    // 解析AI返回的商品信息
    let productInfo;
    const aiResponse = result.response;
    
    // 尝试从AI回复中提取JSON
    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        productInfo = JSON.parse(jsonMatch[0]);
      } else {
        // 如果没有JSON，尝试解析文本
        productInfo = {
          productName: aiResponse.split('\n')[0] || '未识别商品',
          category: '未知',
          keywords: extractKeywords(aiResponse)
        };
      }
    } catch (e) {
      // 如果解析失败，使用AI原始回复
      productInfo = {
        productName: aiResponse.substring(0, 100) || '未识别商品',
        category: '未知',
        keywords: extractKeywords(aiResponse)
      };
    }

    // 清理临时文件
    await fs.unlink(req.file.path).catch(() => {});

    res.json({
      success: true,
      productName: productInfo.productName,
      category: productInfo.category,
      keywords: productInfo.keywords || []
    });

  } catch (err) {
    // 清理临时文件
    if (req.file) {
      await fs.unlink(req.file.path).catch(() => {});
    }

    console.error('商品识别错误:', err);
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({ 
      error: '商品识别失败', 
      detail: err.detail || err.message 
    });
  }
});

// 商品价格查询API
router.post('/search-prices', async (req, res) => {
  const { productName, keywords = [] } = req.body;
  
  if (!productName) {
    return res.status(400).json({ error: '请提供商品名称' });
  }

  try {
    // 搜索关键词
    const searchKeywords = keywords.length > 0 ? keywords.join(' ') : productName;
    
    // 由于直接爬取电商平台有反爬虫机制，这里提供一个框架
    // 实际使用时可以：
    // 1. 使用第三方比价API（如：比价网API、商品比价API等）
    // 2. 使用爬虫框架（如puppeteer）模拟浏览器访问
    // 3. 使用电商平台的开放API（如果有）
    
    // 这里先返回模拟数据作为示例
    // 实际项目中需要替换为真实的爬虫或API调用
    const prices = await searchPricesFromPlatforms(searchKeywords);
    
    res.json({
      success: true,
      productName: productName,
      keywords: keywords,
      ...prices
    });

  } catch (err) {
    console.error('价格查询错误:', err);
    res.status(500).json({ 
      error: '价格查询失败', 
      detail: err.message 
    });
  }
});

module.exports = router;

