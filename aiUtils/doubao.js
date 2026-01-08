// 豆包AI核心方法
const axios = require('axios');
const { DOUBAO_API_KEY, DOUBAO_API_URL, DEFAULT_MODEL, DEFAULT_TIMEOUT } = require('./config');

/**
 * 调用豆包AI进行文本对话
 * @param {string} message - 用户消息
 * @param {Array} history - 历史对话记录，格式: [{role: 'user'|'assistant', content: string}]
 * @param {string} model - 模型名称，默认为 doubao-seed-1-6-251015
 * @param {Object} options - 其他选项
 * @returns {Promise<Object>} 返回AI响应
 */
async function chat(message, history = [], model = DEFAULT_MODEL, options = {}) {
  if (!message) {
    throw new Error('请提供消息内容');
  }

  if (!DOUBAO_API_KEY) {
    throw new Error('未配置豆包API密钥，请在环境变量中设置 DOUBAO_API_KEY');
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
      max_completion_tokens: options.maxCompletionTokens || 65535,  // 豆包AI使用 max_completion_tokens
      temperature: options.temperature || 0.7
    };

    // 如果模型支持推理，可以添加 reasoning_effort 参数
    // 注意：不是所有模型都支持此参数，根据实际模型选择
    if (model.includes('seed') || model.includes('reasoning')) {
      requestBody.reasoning_effort = options.reasoningEffort || 'medium';
    }

    const response = await axios.post(DOUBAO_API_URL, requestBody, {
      headers: {
        'Authorization': `Bearer ${DOUBAO_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: options.timeout || DEFAULT_TIMEOUT
    });

    // 处理豆包AI的响应格式
    const aiResponse = parseResponse(response.data);

    if (!aiResponse) {
      console.error('豆包AI响应数据:', JSON.stringify(response.data, null, 2));
      throw new Error('AI返回内容为空，请检查API响应格式。响应数据已记录到服务器日志。');
    }
    
    return {
      success: true,
      response: aiResponse,
      model: model
    };

  } catch (err) {
    // 处理错误
    throw handleError(err);
  }
}

/**
 * 调用豆包AI进行多模态识别（图片+文本）
 * @param {string} imageDataUrl - 图片的base64 data URL，格式: data:image/jpeg;base64,...
 * @param {string} prompt - 提示文本
 * @param {string} model - 模型名称，默认为 doubao-seed-1-6-251015
 * @param {Object} options - 其他选项
 * @returns {Promise<Object>} 返回AI响应
 */
async function vision(imageDataUrl, prompt, model = DEFAULT_MODEL, options = {}) {
  if (!imageDataUrl || !prompt) {
    throw new Error('请提供图片和提示文本');
  }

  if (!DOUBAO_API_KEY) {
    throw new Error('未配置豆包API密钥，请在环境变量中设置 DOUBAO_API_KEY');
  }

  try {
    const requestBody = {
      model: model,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: imageDataUrl
              }
            },
            {
              type: 'text',
              text: prompt
            }
          ]
        }
      ],
      max_completion_tokens: options.maxCompletionTokens || 1000
    };

    const response = await axios.post(DOUBAO_API_URL, requestBody, {
      headers: {
        'Authorization': `Bearer ${DOUBAO_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: options.timeout || 30000
    });

    // 处理响应
    const aiResponse = parseResponse(response.data);

    return {
      success: true,
      response: aiResponse,
      model: model
    };

  } catch (err) {
    throw handleError(err);
  }
}

/**
 * 解析豆包AI的响应数据
 * @param {Object} responseData - API返回的原始数据
 * @returns {string} 提取的文本内容
 */
function parseResponse(responseData) {
  let aiResponse;
  
  // 豆包AI的标准响应格式：response.data.choices[0].message.content
  if (responseData && responseData.choices && responseData.choices[0]) {
    const choice = responseData.choices[0];
    
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
    aiResponse = responseData?.message || responseData?.content || '';
  }

  return aiResponse;
}

/**
 * 处理豆包AI API错误
 * @param {Error} err - 错误对象
 * @returns {Error} 格式化的错误对象
 */
function handleError(err) {
  console.error('豆包AI API错误:', err.response?.data || err.message);
  console.error('错误详情:', {
    status: err.response?.status,
    statusText: err.response?.statusText,
    data: err.response?.data
  });
  
  // 根据不同的错误状态码返回相应的错误信息
  if (err.response?.status === 401) {
    const error = new Error('API密钥无效，请检查DOUBAO_API_KEY配置');
    error.hint = '请确认API密钥是否正确，格式为: 508ec7e7-b2c5-4f38-9470-e34bf7d39f12';
    error.statusCode = 401;
    return error;
  } else if (err.response?.status === 400) {
    const errorMsg = err.response?.data?.error?.message || err.response?.data?.message || '请求参数错误';
    const error = new Error('请求参数错误');
    error.detail = errorMsg;
    error.hint = '请检查模型名称和请求格式是否正确';
    error.statusCode = 400;
    return error;
  } else if (err.response?.status === 429) {
    const error = new Error('请求过于频繁，请稍后再试');
    error.statusCode = 429;
    return error;
  } else if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
    const error = new Error('请求超时，请稍后重试（豆包AI可能需要更长时间处理）');
    error.statusCode = 504;
    return error;
  } else if (err.response?.data) {
    // 返回豆包AI的具体错误信息
    const errorData = err.response.data;
    const error = new Error('AI服务调用失败');
    error.detail = errorData.error?.message || errorData.message || JSON.stringify(errorData);
    error.statusCode = err.response.status || 500;
    return error;
  } else {
    const error = new Error('AI服务调用失败');
    error.detail = err.message;
    error.statusCode = 500;
    return error;
  }
}

module.exports = {
  chat,
  vision,
  parseResponse,
  handleError
};









