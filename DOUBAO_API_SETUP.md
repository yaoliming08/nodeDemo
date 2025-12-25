# 豆包AI API配置说明

## 获取API密钥

1. 访问豆包AI官网：https://www.volcengine.com/product/doubao
2. 注册/登录火山引擎账号
3. 开通豆包AI服务
4. 在控制台获取API Key

## 配置方式

### 方式一：环境变量（推荐）

在启动服务器前设置环境变量：

**Windows (PowerShell):**
```powershell
$env:DOUBAO_API_KEY="your-api-key-here"
node app.js
```

**Windows (CMD):**
```cmd
set DOUBAO_API_KEY=your-api-key-here
node app.js
```

**Linux/Mac:**
```bash
export DOUBAO_API_KEY=your-api-key-here
node app.js
```

### 方式二：修改代码

在 `app.js` 文件中找到以下代码：
```javascript
const DOUBAO_API_KEY = process.env.DOUBAO_API_KEY || '';
```

修改为：
```javascript
const DOUBAO_API_KEY = process.env.DOUBAO_API_KEY || 'your-api-key-here';
```

⚠️ **注意：** 不要将API密钥提交到Git仓库！

## API端点配置

根据您的账号所在区域，可能需要设置不同的API端点：

**方式一：环境变量**
```bash
export DOUBAO_API_URL=https://ark.cn-beijing.volces.com/api/v3/chat/completions
```

**方式二：修改代码**
在 `app.js` 中修改 `DOUBAO_API_URL` 变量

常见端点：
- 北京: `https://ark.cn-beijing.volces.com/api/v3/chat/completions`
- 上海: `https://ark.cn-shanghai.volces.com/api/v3/chat/completions`

## 模型选择

根据您的API密钥，可用的模型可能包括：

- `doubao-seed-1-6-251015`: 豆包Seed模型（推荐，支持推理，性能强大）
- `doubao-pro-32k`: 豆包Pro模型（32K上下文）
- `doubao-lite-4k`: 豆包Lite模型（经济实惠，4K上下文）

**注意：** 实际可用的模型名称可能因您的账号而异，请查看豆包AI控制台获取准确的模型列表。

## 价格参考

- 豆包Pro: 约 ¥0.012/1K tokens
- 豆包Lite: 约 ¥0.003/1K tokens

## 常见问题

### 1. API密钥无效
- 检查API密钥是否正确
- 确认账号是否已开通豆包AI服务
- 检查API密钥是否过期

### 2. 请求失败
- 检查网络连接
- 确认API端点URL是否正确
- 查看服务器日志获取详细错误信息

### 3. 响应格式错误
- 豆包AI的API格式可能与代码中的预期不同
- 可以查看 `app.js` 中的响应处理逻辑，根据实际返回格式调整

## API调用示例

根据您提供的API格式，豆包AI的调用方式如下：

```bash
curl https://ark.cn-beijing.volces.com/api/v3/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "doubao-seed-1-6-251015",
    "max_completion_tokens": 65535,
    "messages": [
      {
        "role": "user",
        "content": "你好"
      }
    ],
    "reasoning_effort": "medium"
  }'
```

## 测试

配置完成后，访问 `http://localhost:3000/ai-chat.html` 测试功能。

如果遇到问题，请查看浏览器控制台和服务器日志获取详细错误信息。

## 注意事项

1. **API密钥格式**：豆包AI的API密钥格式为UUID，例如：`508ec7e7-b2c5-4f38-9470-e34bf7d39f12`

2. **模型名称**：不同账号可用的模型可能不同，请根据控制台显示的模型名称进行配置

3. **超时时间**：豆包AI某些模型（如Seed）可能需要较长的处理时间，代码中已设置60秒超时

4. **参数说明**：
   - `max_completion_tokens`: 最大输出token数（豆包AI使用此参数而非max_tokens）
   - `reasoning_effort`: 推理努力程度（仅部分模型支持，如Seed模型）

