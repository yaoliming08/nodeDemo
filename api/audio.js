// 音频相关接口
const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');

// 获取音频base64数据的API端点
router.get('/audio/:filename', async (req, res) => {
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
    const filePath = path.join(__dirname, '..', 'file', filename);
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

module.exports = router;










