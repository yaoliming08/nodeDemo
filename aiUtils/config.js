// 豆包AI配置
// 获取方式：https://www.volcengine.com/product/doubao
// 注意：豆包AI的API端点可能因地区而异，请根据实际情况调整

// 豆包AI API密钥
// 优先从环境变量读取，如果没有则使用默认值
const DOUBAO_API_KEY = process.env.DOUBAO_API_KEY || '508ec7e7-b2c5-4f38-9470-e34bf7d39f12';

// 豆包AI API端点（根据您的账号区域选择）
// 北京: https://ark.cn-beijing.volces.com/api/v3/chat/completions
// 上海: https://ark.cn-shanghai.volces.com/api/v3/chat/completions
const DOUBAO_API_URL = process.env.DOUBAO_API_URL || 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';

// 默认模型
const DEFAULT_MODEL = 'doubao-seed-1-6-251015';

// 默认超时时间（毫秒）
const DEFAULT_TIMEOUT = 60000; // 60秒

module.exports = {
  DOUBAO_API_KEY,
  DOUBAO_API_URL,
  DEFAULT_MODEL,
  DEFAULT_TIMEOUT
};


