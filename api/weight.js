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

// 获取当前用户的所有减肥记录列表（按日期正序，用于前端显示）
router.get('/weight-records', async (req, res) => {
  // 检查是否已登录
  if (!req.session || !req.session.isAuthenticated) {
    return res.status(401).json({ error: '未登录，请先登录' });
  }

  const userId = req.session.userId;
  const { startDate, endDate } = req.query;

  try {
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
      
      return {
        id: record.id,
        user_id: record.user_id,
        record_date: recordDate, // 统一格式为 YYYY-MM-DD
        weight: parseFloat(record.weight),
        initial_weight: parseFloat(record.initial_weight),
        target_weight: parseFloat(record.target_weight),
        target_loss: parseFloat(record.target_loss),
        lost_weight: parseFloat(record.lost_weight),
        remaining_weight: parseFloat(record.remaining_weight),
        photos: photos.map(photo => `/api/weight/photos/${record.user_id}/${path.basename(photo)}`),
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

  // 验证必填字段
  if (!date || !weight || !initial_weight || !target_weight || !target_loss) {
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
    console.error('保存减肥记录失败:', err);
    
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
    
    res.status(500).json({ error: 'Database error', detail: err.message });
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

module.exports = router;

