// 工具函数

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

// 提取关键词的辅助函数
function extractKeywords(text) {
  const keywords = [];
  // 提取可能的品牌和型号
  const brandPattern = /(?:品牌|牌子)[:：]\s*([^\n,，]+)/i;
  const modelPattern = /(?:型号|规格)[:：]\s*([^\n,，]+)/i;
  
  const brandMatch = text.match(brandPattern);
  const modelMatch = text.match(modelPattern);
  
  if (brandMatch) keywords.push(brandMatch[1].trim());
  if (modelMatch) keywords.push(modelMatch[1].trim());
  
  // 提取常见商品关键词
  const commonKeywords = ['手机', '电脑', '耳机', '键盘', '鼠标', '衣服', '鞋子', '包', '手表'];
  commonKeywords.forEach(keyword => {
    if (text.includes(keyword) && !keywords.includes(keyword)) {
      keywords.push(keyword);
    }
  });
  
  return keywords.slice(0, 5);
}

// 从各平台搜索价格（模拟数据，实际需要替换为真实爬虫）
async function searchPricesFromPlatforms(keywords) {
  // 注意：这里返回的是模拟数据
  // 实际实现需要：
  // 1. 使用puppeteer等工具爬取电商平台
  // 2. 或使用第三方比价API服务
  // 3. 或使用电商平台的开放API
  
  // 模拟数据生成
  const basePrice = 100 + Math.random() * 500;
  
  const generatePrices = (platform, count = 10) => {
    const prices = [];
    for (let i = 0; i < count; i++) {
      const variation = (Math.random() - 0.5) * 200; // ±100的波动
      const price = (basePrice + variation).toFixed(2);
      prices.push({
        shopName: `${platform}店铺${i + 1}`,
        price: price,
        link: `https://www.${platform === 'taobao' ? 'taobao.com' : platform === 'pdd' ? 'pinduoduo.com' : 'jd.com'}/item/${Math.random().toString(36).substr(2, 9)}`
      });
    }
    // 按价格排序
    return prices.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
  };

  return {
    taobao: generatePrices('taobao', 10),
    pdd: generatePrices('pdd', 10),
    jd: generatePrices('jd', 10)
  };
}

module.exports = {
  createRandomUser,
  extractKeywords,
  searchPricesFromPlatforms
};











