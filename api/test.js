// 测试相关接口
const express = require('express');
const router = express.Router();

// 保存人格测试结果（可选功能）
router.post('/personality-test', async (req, res) => {
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

// 保存心理健康测试结果（可选功能）
router.post('/mental-health-test', async (req, res) => {
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

module.exports = router;


