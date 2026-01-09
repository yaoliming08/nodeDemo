// 减肥记录相关接口
const express = require('express');
const router = express.Router();
const pool = require('./db');
const multer = require('multer');
const fs = require('fs').promises;
const path = require('path');

// 配置文件上传
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    // 根据用户ID创建目录
    const userId = req.session?.userId || 'anonymous';
    const uploadDir = path.join(__dirname, '../uploads/weight', String(userId));
    
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (err) {
      cb(err, uploadDir);
    }
  },
  filename: (req, file, cb) => {
    // 文件名格式：日期_时间戳_原始文件名
    const timestamp = Date.now();
    const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    const filename = `${date}_${timestamp}_${name}${ext}`;
    cb(null, filename);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    // 只允许图片文件
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('只允许上传图片文件'));
    }
  }
});

// 计算每日消耗热量（BMR + 活动消耗）
// 使用Mifflin-St Jeor公式计算BMR
function calculateDailyCalories(weightKg, heightCm, age, gender, activityLevel = 1.375) {
  // 体重从斤转换为公斤
  const weight = weightKg / 2;
  
  // 如果没有身高，使用默认值（根据体重估算，假设BMI=25）
  // BMI = weight(kg) / (height(m))^2 = 25
  // height(m) = sqrt(weight / 25)
  // height(cm) = sqrt(weight / 25) * 100
  let height;
  if (heightCm && heightCm > 0) {
    height = heightCm;
  } else {
    // 根据体重估算身高（假设BMI=25）
    height = Math.sqrt(weight / 25) * 100;
    console.log(`⚠️ 用户没有身高数据，根据体重估算身高: ${height.toFixed(1)}cm (体重: ${weight}kg)`);
  }
  
  // 如果没有年龄，使用默认值30
  const ageValue = age || 30;
  
  // 验证计算参数
  if (weight <= 0 || height <= 0 || ageValue <= 0) {
    console.error('❌ 计算参数无效:', { weight, height, ageValue });
    return {
      bmr: 0,
      tdee: 0,
      activityLevel
    };
  }
  
  // 计算BMR（基础代谢率）- 使用Mifflin-St Jeor公式
  let bmr;
  if (gender === '女' || gender === 'female' || gender === 'F' || gender === 'female') {
    // 女性：BMR = 10 × 体重(kg) + 6.25 × 身高(cm) - 5 × 年龄(岁) - 161
    bmr = 10 * weight + 6.25 * height - 5 * ageValue - 161;
  } else {
    // 男性：BMR = 10 × 体重(kg) + 6.25 × 身高(cm) - 5 × 年龄(岁) + 5
    bmr = 10 * weight + 6.25 * height - 5 * ageValue + 5;
  }
  
  // 根据活动量计算总消耗（TDEE）
  // activityLevel: 1.2=久坐, 1.375=轻度活动, 1.55=中度活动, 1.725=高度活动, 1.9=极高活动
  const tdee = bmr * activityLevel;
  
  console.log(`📊 热量计算: 体重=${weight}kg, 身高=${height}cm, 年龄=${ageValue}, 性别=${gender}, BMR=${bmr.toFixed(0)}, TDEE=${tdee.toFixed(0)}`);
  
  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    activityLevel
  };
}

// 获取当前用户的所有减肥记录列表（按日期正序，用于前端显示）
router.get('/weight-records', async (req, res) => {
  // 检查是否已登录
  if (!req.session || !req.session.isAuthenticated) {
    return res.status(401).json({ error: '未登录，请先登录' });
  }

  const userId = req.session.userId;
  const { startDate, endDate } = req.query;

  try {
    // 获取用户信息（身高、年龄、性别）
    // 使用COALESCE处理可能不存在的height字段
    let userInfo;
    try {
      [userInfo] = await pool.query(
        'SELECT `gender`, `age`, `height` FROM `user` WHERE `user_id` = ?',
        [userId]
      );
    } catch (err) {
      // 如果height字段不存在，只查询gender和age
      if (err.code === 'ER_BAD_FIELD_ERROR' && err.message.includes('height')) {
        console.warn('⚠️ user表没有height字段，使用默认值');
        [userInfo] = await pool.query(
          'SELECT `gender`, `age` FROM `user` WHERE `user_id` = ?',
          [userId]
        );
      } else {
        throw err;
      }
    }
    
    const user = userInfo[0] || {};
    const userGender = user.gender || '男';
    const userAge = user.age || 30;
    const userHeight = user.height || null;

    let sql = 'SELECT * FROM `weight_records` WHERE `user_id` = ?';
    const params = [userId];

    // 如果指定了日期范围
    if (startDate) {
      sql += ' AND `record_date` >= ?';
      params.push(startDate);
    }
    if (endDate) {
      sql += ' AND `record_date` <= ?';
      params.push(endDate);
    }

    // 按日期正序排列（从最早到最新）
    sql += ' ORDER BY `record_date` ASC';

    const [rows] = await pool.query(sql, params);

    // 处理照片路径，转换为完整的URL，并格式化数据
    const records = rows.map(record => {
      const photos = record.photos ? JSON.parse(record.photos) : [];
      
      // 确保日期格式为 YYYY-MM-DD（使用本地时区，避免UTC转换导致的日期偏移）
      let recordDate = record.record_date;
      if (recordDate instanceof Date) {
        // 使用本地时区格式化，而不是UTC
        const year = recordDate.getFullYear();
        const month = String(recordDate.getMonth() + 1).padStart(2, '0');
        const day = String(recordDate.getDate()).padStart(2, '0');
        recordDate = `${year}-${month}-${day}`;
      } else if (typeof recordDate === 'string') {
        // 如果是字符串，提取日期部分（处理各种格式）
        recordDate = recordDate.split('T')[0].split(' ')[0];
      }
      
      // 处理食物照片
      const foodPhotos = record.food_photos ? JSON.parse(record.food_photos) : [];
      
      // 计算该日期的消耗热量
      const weightKg = parseFloat(record.weight);
      const caloriesData = calculateDailyCalories(weightKg, userHeight, userAge, userGender);
      
      // 计算热量差值（消耗 - 摄入）
      const intakeCalories = record.calories ? parseFloat(record.calories) : 0;
      const calorieDeficit = caloriesData.tdee - intakeCalories;
      
      return {
        id: record.id,
        user_id: record.user_id,
        record_date: recordDate, // 统一格式为 YYYY-MM-DD
        weight: weightKg,
        initial_weight: parseFloat(record.initial_weight),
        target_weight: parseFloat(record.target_weight),
        target_loss: parseFloat(record.target_loss),
        lost_weight: parseFloat(record.lost_weight),
        remaining_weight: parseFloat(record.remaining_weight),
        photos: photos.map(photo => `/api/weight/photos/${record.user_id}/${path.basename(photo)}`),
        food_photos: foodPhotos.map(photo => `/api/weight/photos/${record.user_id}/${path.basename(photo)}`),
        calories: intakeCalories > 0 ? intakeCalories : null,
        calories_analysis: record.calories_analysis ? JSON.parse(record.calories_analysis) : null,
        // 新增字段
        daily_calories_burn: caloriesData.tdee, // 每日消耗热量
        bmr: caloriesData.bmr, // 基础代谢率
        calorie_deficit: calorieDeficit, // 热量差值（消耗 - 摄入）
        notes: record.notes,
        created_at: record.created_at,
        updated_at: record.updated_at
      };
    });

    res.json({
      success: true,
      data: records,
      total: records.length
    });
  } catch (err) {
    console.error('获取减肥记录失败:', err);
    res.status(500).json({ error: 'Database error', detail: err.message });
  }
});

// 获取指定日期的减肥记录
router.get('/weight-records/:date', async (req, res) => {
  if (!req.session || !req.session.isAuthenticated) {
    return res.status(401).json({ error: '未登录，请先登录' });
  }

  const userId = req.session.userId;
  const { date } = req.params;

  try {
    const [rows] = await pool.query(
      'SELECT * FROM `weight_records` WHERE `user_id` = ? AND `record_date` = ?',
      [userId, date]
    );

    if (rows.length === 0) {
      return res.json({
        success: true,
        data: null
      });
    }

    const record = rows[0];
    const photos = record.photos ? JSON.parse(record.photos) : [];
    
    res.json({
      success: true,
      data: {
        ...record,
        photos: photos.map(photo => `/api/weight/photos/${record.user_id}/${path.basename(photo)}`),
        weight: parseFloat(record.weight),
        initial_weight: parseFloat(record.initial_weight),
        target_weight: parseFloat(record.target_weight),
        target_loss: parseFloat(record.target_loss),
        lost_weight: parseFloat(record.lost_weight),
        remaining_weight: parseFloat(record.remaining_weight)
      }
    });
  } catch (err) {
    console.error('获取减肥记录失败:', err);
    res.status(500).json({ error: 'Database error', detail: err.message });
  }
});

// 创建或更新减肥记录
router.post('/weight-records', upload.array('photos', 10), async (req, res) => {
  if (!req.session || !req.session.isAuthenticated) {
    return res.status(401).json({ error: '未登录，请先登录' });
  }

  const userId = req.session.userId;
  const { date, weight, initial_weight, target_weight, target_loss, notes } = req.body;

  // 调试日志
  console.log('📥 接收上传请求:', {
    userId,
    date,
    weight,
    initial_weight,
    target_weight,
    target_loss,
    filesCount: req.files ? req.files.length : 0
  });

  // 验证必填字段
  if (!date || !weight || !initial_weight || !target_weight || !target_loss) {
    console.error('❌ 缺少必填字段:', { date, weight, initial_weight, target_weight, target_loss });
    return res.status(400).json({ error: '缺少必填字段：date, weight, initial_weight, target_weight, target_loss' });
  }

  try {
    const weightNum = parseFloat(weight);
    const initialWeightNum = parseFloat(initial_weight);
    const targetWeightNum = parseFloat(target_weight);
    const targetLossNum = parseFloat(target_loss);

    // 验证数据范围
    if (isNaN(weightNum) || weightNum < 0 || weightNum > 9999.99) {
      return res.status(400).json({ error: '体重值必须在0-9999.99之间' });
    }
    if (isNaN(initialWeightNum) || initialWeightNum < 0 || initialWeightNum > 9999.99) {
      return res.status(400).json({ error: '初始体重值必须在0-9999.99之间' });
    }
    if (isNaN(targetLossNum) || targetLossNum < 0 || targetLossNum > 9999.99) {
      return res.status(400).json({ error: '目标减重值必须在0-9999.99之间' });
    }

    // 计算已减体重和待减体重
    const lostWeight = initialWeightNum - weightNum;
    const remainingWeight = Math.max(0, targetLossNum - lostWeight);
    
    // 验证计算结果
    if (Math.abs(lostWeight) > 9999.99 || remainingWeight > 9999.99) {
      return res.status(400).json({ error: '计算结果超出范围，请检查输入值' });
    }

    // 处理上传的照片
    let photos = [];
    if (req.files && req.files.length > 0) {
      photos = req.files.map(file => file.path);
    }

    // 检查是否已存在该日期的记录
    const [existing] = await pool.query(
      'SELECT id, photos FROM `weight_records` WHERE `user_id` = ? AND `record_date` = ?',
      [userId, date]
    );

    if (existing.length > 0) {
      // 更新现有记录
      const existingPhotos = existing[0].photos ? JSON.parse(existing[0].photos) : [];
      // 如果上传了新照片，合并到现有照片；否则保持原有照片
      const allPhotos = photos.length > 0 ? [...existingPhotos, ...photos] : existingPhotos;

      await pool.query(
        `UPDATE \`weight_records\` 
         SET \`weight\` = ?, \`initial_weight\` = ?, \`target_weight\` = ?, \`target_loss\` = ?,
             \`lost_weight\` = ?, \`remaining_weight\` = ?, \`photos\` = ?, \`notes\` = ?
         WHERE \`user_id\` = ? AND \`record_date\` = ?`,
        [
          weightNum, initialWeightNum, targetWeightNum, targetLossNum,
          lostWeight, remainingWeight, JSON.stringify(allPhotos), notes || null,
          userId, date
        ]
      );

      const recordId = existing[0].id;
      res.json({
        success: true,
        message: '更新成功',
        data: {
          id: recordId,
          user_id: userId,
          record_date: date,
          weight: weightNum,
          initial_weight: initialWeightNum,
          target_weight: targetWeightNum,
          target_loss: targetLossNum,
          lost_weight: lostWeight,
          remaining_weight: remainingWeight,
          photos: allPhotos.map(photo => `/api/weight/photos/${userId}/${path.basename(photo)}`),
          notes: notes || null
        }
      });
    } else {
      // 创建新记录
      const [result] = await pool.query(
        `INSERT INTO \`weight_records\` 
         (\`user_id\`, \`record_date\`, \`weight\`, \`initial_weight\`, \`target_weight\`, 
          \`target_loss\`, \`lost_weight\`, \`remaining_weight\`, \`photos\`, \`notes\`) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId, date, weightNum, initialWeightNum, targetWeightNum, targetLossNum,
          lostWeight, remainingWeight, JSON.stringify(photos), notes || null
        ]
      );

      res.json({
        success: true,
        message: '创建成功',
        data: {
          id: result.insertId,
          user_id: userId,
          record_date: date,
          weight: weightNum,
          initial_weight: initialWeightNum,
          target_weight: targetWeightNum,
          target_loss: targetLossNum,
          lost_weight: lostWeight,
          remaining_weight: remainingWeight,
          photos: photos.map(photo => `/api/weight/photos/${userId}/${path.basename(photo)}`),
          notes: notes || null
        }
      });
    }
  } catch (err) {
    console.error('❌ 保存减肥记录失败:', err);
    console.error('错误堆栈:', err.stack);
    
    // 清理已上传的文件
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        try {
          await fs.unlink(file.path);
        } catch (unlinkErr) {
          console.error('清理文件失败:', unlinkErr);
        }
      }
    }
    
    // 返回更详细的错误信息
    const errorMessage = err.message || '未知错误';
    res.status(500).json({ 
      success: false,
      error: '保存失败', 
      detail: errorMessage,
      message: errorMessage
    });
  }
});

// 删除减肥记录
router.delete('/weight-records/:date', async (req, res) => {
  if (!req.session || !req.session.isAuthenticated) {
    return res.status(401).json({ error: '未登录，请先登录' });
  }

  const userId = req.session.userId;
  const { date } = req.params;

  try {
    // 先获取记录中的照片路径
    const [records] = await pool.query(
      'SELECT photos FROM `weight_records` WHERE `user_id` = ? AND `record_date` = ?',
      [userId, date]
    );

    if (records.length === 0) {
      return res.status(404).json({ error: '记录不存在' });
    }

    // 删除照片文件
    if (records[0].photos) {
      const photos = JSON.parse(records[0].photos);
      for (const photoPath of photos) {
        try {
          await fs.unlink(photoPath);
        } catch (err) {
          console.error('删除照片失败:', err);
        }
      }
    }

    // 删除数据库记录
    await pool.query(
      'DELETE FROM `weight_records` WHERE `user_id` = ? AND `record_date` = ?',
      [userId, date]
    );

    res.json({
      success: true,
      message: '删除成功'
    });
  } catch (err) {
    console.error('删除减肥记录失败:', err);
    res.status(500).json({ error: 'Database error', detail: err.message });
  }
});

// 删除照片
router.delete('/weight-records/:date/photos/:filename', async (req, res) => {
  if (!req.session || !req.session.isAuthenticated) {
    return res.status(401).json({ error: '未登录，请先登录' });
  }

  const userId = req.session.userId;
  const { date, filename } = req.params;

  try {
    // 获取记录
    const [records] = await pool.query(
      'SELECT photos FROM `weight_records` WHERE `user_id` = ? AND `record_date` = ?',
      [userId, date]
    );

    if (records.length === 0) {
      return res.status(404).json({ error: '记录不存在' });
    }

    const photos = records[0].photos ? JSON.parse(records[0].photos) : [];
    const photoPath = photos.find(p => path.basename(p) === filename);

    if (!photoPath) {
      return res.status(404).json({ error: '照片不存在' });
    }

    // 删除文件
    try {
      await fs.unlink(photoPath);
    } catch (err) {
      console.error('删除照片文件失败:', err);
    }

    // 更新数据库
    const updatedPhotos = photos.filter(p => path.basename(p) !== filename);
    await pool.query(
      'UPDATE `weight_records` SET `photos` = ? WHERE `user_id` = ? AND `record_date` = ?',
      [JSON.stringify(updatedPhotos), userId, date]
    );

    res.json({
      success: true,
      message: '删除成功',
      data: {
        photos: updatedPhotos.map(photo => `/api/weight/photos/${userId}/${path.basename(photo)}`)
      }
    });
  } catch (err) {
    console.error('删除照片失败:', err);
    res.status(500).json({ error: 'Database error', detail: err.message });
  }
});

// 获取照片文件
router.get('/weight/photos/:userId/:filename', async (req, res) => {
  const { userId, filename } = req.params;
  const filePath = path.join(__dirname, '../uploads/weight', userId, filename);

  try {
    // 检查文件是否存在
    await fs.access(filePath);
    
    // 设置响应头
    res.setHeader('Content-Type', 'image/jpeg');
    res.sendFile(path.resolve(filePath));
  } catch (err) {
    res.status(404).json({ error: '照片不存在' });
  }
});

// 上传食物照片并分析卡路里
const { vision: doubaoVision } = require('../aiUtils/doubao');

// Multer错误处理中间件
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    console.error('❌ Multer错误:', err);
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        success: false,
        error: '文件过大', 
        detail: '单个文件不能超过10MB'
      });
    } else if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ 
        success: false,
        error: '文件数量过多', 
        detail: '最多只能上传10张照片'
      });
    } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ 
        success: false,
        error: '文件字段名错误', 
        detail: '请使用 food_photos 作为文件字段名'
      });
    }
    return res.status(400).json({ 
      success: false,
      error: '文件上传错误', 
      detail: err.message
    });
  } else if (err) {
    console.error('❌ 其他错误:', err);
    return res.status(500).json({ 
      success: false,
      error: '上传失败', 
      detail: err.message
    });
  }
  next();
};

router.post('/weight-records/food', upload.array('food_photos', 10), handleMulterError, async (req, res) => {
  // 调试日志
  console.log('📥 接收食物照片上传请求:', {
    hasSession: !!req.session,
    isAuthenticated: req.session?.isAuthenticated,
    userId: req.session?.userId,
    body: req.body,
    filesCount: req.files ? req.files.length : 0,
    files: req.files ? req.files.map(f => ({ name: f.originalname, size: f.size, mimetype: f.mimetype })) : []
  });

  if (!req.session || !req.session.isAuthenticated) {
    return res.status(401).json({ error: '未登录，请先登录' });
  }

  const userId = req.session.userId;
  const { date, food_description } = req.body;

  if (!date) {
    console.error('❌ 缺少必填字段 date');
    return res.status(400).json({ error: '缺少必填字段：date' });
  }

  try {
    // 检查该日期是否有记录
    const [existing] = await pool.query(
      'SELECT * FROM `weight_records` WHERE `user_id` = ? AND `record_date` = ?',
      [userId, date]
    );

    if (existing.length === 0) {
      console.error('❌ 该日期没有体重记录:', { userId, date });
      return res.status(400).json({ error: '请先输入该日期的体重记录' });
    }

    console.log('✅ 找到该日期的记录:', { recordId: existing[0].id, weight: existing[0].weight });

    // 处理上传的食物照片
    let newFoodPhotos = [];
    if (req.files && req.files.length > 0) {
      newFoodPhotos = req.files.map(file => file.path);
      console.log('📸 上传了食物照片:', newFoodPhotos);
    } else {
      console.warn('⚠️ 没有收到上传的文件');
    }

    // 获取现有的食物照片
    const existingFoodPhotos = existing[0].food_photos ? JSON.parse(existing[0].food_photos) : [];
    const allFoodPhotos = [...existingFoodPhotos, ...newFoodPhotos];

    // 调用AI分析新上传的照片
    let totalCalories = existing[0].calories ? parseFloat(existing[0].calories) : 0;
    let caloriesAnalysis = existing[0].calories_analysis ? JSON.parse(existing[0].calories_analysis) : [];

    if (req.files && req.files.length > 0) {
      console.log(`🤖 开始分析 ${req.files.length} 张食物照片的卡路里...`);
      
      for (const file of req.files) {
        try {
          // 读取图片文件并转换为base64
          const imageBuffer = await fs.readFile(file.path);
          const imageBase64 = imageBuffer.toString('base64');
          const imageMimeType = file.mimetype;
          const imageDataUrl = `data:${imageMimeType};base64,${imageBase64}`;

          // 调用豆包AI分析食物卡路里
          let prompt = `请分析这张食物照片，告诉我：
1. 照片中有哪些食物（尽量详细，包括食物名称和大概的分量）
2. 每种食物的估算卡路里（大卡）
3. 总卡路里（大卡）

请用JSON格式返回：
{
  "foods": [
    {"name": "食物名称", "portion": "分量描述", "calories": 卡路里数字}
  ],
  "totalCalories": 总卡路里数字
}

如果无法识别，请返回 {"error": "无法识别食物"}。`;

          // 如果用户提供了食物描述，将其添加到提示中
          if (food_description && food_description.trim()) {
            prompt = `用户提供了以下食物描述信息：${food_description.trim()}

${prompt}

请注意：请参考用户提供的描述信息，结合照片内容进行分析。如果用户的描述与照片一致，请优先使用用户描述中的信息（如：有糖/无糖、具体分量等）。`;
            console.log('💬 用户提供了食物描述:', food_description.trim());
          }

          const result = await doubaoVision(imageDataUrl, prompt, 'doubao-seed-1-6-251015', {
            maxCompletionTokens: 2000,
            timeout: 30000
          });

          // 解析AI返回的JSON
          const aiResponse = result.response;
          console.log('🤖 AI分析结果:', aiResponse);

          // 尝试从AI回复中提取JSON
          let foodInfo;
          try {
            // 尝试直接解析JSON
            foodInfo = JSON.parse(aiResponse);
          } catch (e) {
            // 如果直接解析失败，尝试提取JSON部分
            const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              foodInfo = JSON.parse(jsonMatch[0]);
            } else {
              throw new Error('无法从AI回复中提取JSON');
            }
          }

          if (foodInfo.error) {
            console.warn('⚠️ AI无法识别食物:', foodInfo.error);
            caloriesAnalysis.push({
              photo: path.basename(file.path),
              error: foodInfo.error,
              timestamp: new Date().toISOString()
            });
          } else if (foodInfo.totalCalories) {
            const photoCalories = parseFloat(foodInfo.totalCalories) || 0;
            totalCalories += photoCalories;
            caloriesAnalysis.push({
              photo: path.basename(file.path),
              foods: foodInfo.foods || [],
              calories: photoCalories,
              timestamp: new Date().toISOString()
            });
            console.log(`✅ 照片 ${path.basename(file.path)} 分析完成，卡路里: ${photoCalories}`);
          }
        } catch (err) {
          console.error('❌ 分析照片失败:', err);
          caloriesAnalysis.push({
            photo: path.basename(file.path),
            error: err.message || '分析失败',
            timestamp: new Date().toISOString()
          });
        }
      }
    }

    // 更新数据库
    await pool.query(
      `UPDATE \`weight_records\` 
       SET \`food_photos\` = ?, \`calories\` = ?, \`calories_analysis\` = ?
       WHERE \`user_id\` = ? AND \`record_date\` = ?`,
      [
        JSON.stringify(allFoodPhotos),
        totalCalories,
        JSON.stringify(caloriesAnalysis),
        userId,
        date
      ]
    );

    // 获取更新后的记录
    const [updated] = await pool.query(
      'SELECT * FROM `weight_records` WHERE `user_id` = ? AND `record_date` = ?',
      [userId, date]
    );

    const record = updated[0];
    const photos = record.photos ? JSON.parse(record.photos) : [];
    const foodPhotos = record.food_photos ? JSON.parse(record.food_photos) : [];

    // 获取用户信息用于计算消耗热量
    let userInfo;
    try {
      [userInfo] = await pool.query(
        'SELECT `gender`, `age`, `height` FROM `user` WHERE `user_id` = ?',
        [userId]
      );
    } catch (err) {
      // 如果height字段不存在，只查询gender和age
      if (err.code === 'ER_BAD_FIELD_ERROR' && err.message.includes('height')) {
        console.warn('⚠️ user表没有height字段，使用默认值');
        [userInfo] = await pool.query(
          'SELECT `gender`, `age` FROM `user` WHERE `user_id` = ?',
          [userId]
        );
      } else {
        throw err;
      }
    }
    const user = userInfo[0] || {};
    const weightKg = parseFloat(record.weight);
    const caloriesData = calculateDailyCalories(weightKg, user.height, user.age, user.gender || '男');
    const calorieDeficit = caloriesData.tdee - totalCalories;

    res.json({
      success: true,
      message: '上传成功',
      data: {
        id: record.id,
        user_id: userId,
        record_date: date,
        weight: weightKg,
        photos: photos.map(photo => `/api/weight/photos/${userId}/${path.basename(photo)}`),
        food_photos: foodPhotos.map(photo => `/api/weight/photos/${userId}/${path.basename(photo)}`),
        calories: totalCalories,
        calories_analysis: caloriesAnalysis,
        daily_calories_burn: caloriesData.tdee,
        bmr: caloriesData.bmr,
        calorie_deficit: calorieDeficit
      }
    });
  } catch (err) {
    console.error('❌ 上传食物照片失败:', err);
    console.error('错误堆栈:', err.stack);
    
    // 清理已上传的文件
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        try {
          await fs.unlink(file.path);
        } catch (unlinkErr) {
          console.error('清理文件失败:', unlinkErr);
        }
      }
    }
    
    res.status(500).json({ 
      success: false,
      error: '上传失败', 
      detail: err.message
    });
  }
});

// 删除食物照片
router.delete('/weight-records/:date/food-photos/:filename', async (req, res) => {
  if (!req.session || !req.session.isAuthenticated) {
    return res.status(401).json({ error: '未登录，请先登录' });
  }

  const userId = req.session.userId;
  const { date, filename } = req.params;

  try {
    const [records] = await pool.query(
      'SELECT * FROM `weight_records` WHERE `user_id` = ? AND `record_date` = ?',
      [userId, date]
    );

    if (records.length === 0) {
      return res.status(404).json({ error: '记录不存在' });
    }

    const record = records[0];
    const foodPhotos = record.food_photos ? JSON.parse(record.food_photos) : [];
    const caloriesAnalysis = record.calories_analysis ? JSON.parse(record.calories_analysis) : [];

    // 找到要删除的照片
    const photoToDelete = foodPhotos.find(photo => path.basename(photo) === filename);
    if (!photoToDelete) {
      return res.status(404).json({ error: '照片不存在' });
    }

    // 删除文件
    const filePath = path.join(__dirname, '../uploads/weight', String(userId), filename);
    try {
      await fs.unlink(filePath);
    } catch (err) {
      console.error('删除照片文件失败:', err);
    }

    // 从数组中移除
    const updatedFoodPhotos = foodPhotos.filter(photo => path.basename(photo) !== filename);
    
    // 移除对应的分析数据
    const updatedCaloriesAnalysis = caloriesAnalysis.filter(analysis => analysis.photo !== filename);
    
    // 重新计算总卡路里
    const totalCalories = updatedCaloriesAnalysis.reduce((sum, analysis) => {
      return sum + (parseFloat(analysis.calories) || 0);
    }, 0);

    // 更新数据库
    await pool.query(
      `UPDATE \`weight_records\` 
       SET \`food_photos\` = ?, \`calories\` = ?, \`calories_analysis\` = ?
       WHERE \`user_id\` = ? AND \`record_date\` = ?`,
      [
        JSON.stringify(updatedFoodPhotos),
        totalCalories,
        JSON.stringify(updatedCaloriesAnalysis),
        userId,
        date
      ]
    );

    res.json({
      success: true,
      message: '删除成功',
      data: {
        food_photos: updatedFoodPhotos.map(photo => `/api/weight/photos/${userId}/${path.basename(photo)}`),
        calories: totalCalories
      }
    });
  } catch (err) {
    console.error('删除食物照片失败:', err);
    res.status(500).json({ error: 'Database error', detail: err.message });
  }
});

module.exports = router;

