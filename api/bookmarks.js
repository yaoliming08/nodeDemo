// 网址导航相关接口
const express = require('express');
const router = express.Router();
const pool = require('./db');

// 获取当前用户的所有书签
router.get('/bookmarks', async (req, res) => {
  // 检查是否已登录
  if (!req.session || !req.session.isAuthenticated) {
    return res.status(401).json({ error: '未登录，请先登录' });
  }

  const userId = req.session.userId;

  try {
    const sql = `
      SELECT * FROM \`bookmarks\` 
      WHERE \`user_id\` = ? 
      ORDER BY \`sort_order\` ASC, \`created_at\` DESC
    `;
    const [rows] = await pool.query(sql, [userId]);
    res.json({
      success: true,
      data: rows,
      count: rows.length
    });
  } catch (err) {
    console.error('DB error:', err);
    res.status(500).json({ error: 'Database error', detail: err.message });
  }
});

// 按分类获取书签
router.get('/bookmarks/category/:category', async (req, res) => {
  if (!req.session || !req.session.isAuthenticated) {
    return res.status(401).json({ error: '未登录，请先登录' });
  }

  const userId = req.session.userId;
  const { category } = req.params;

  try {
    const sql = `
      SELECT * FROM \`bookmarks\` 
      WHERE \`user_id\` = ? AND \`category\` = ? 
      ORDER BY \`sort_order\` ASC, \`created_at\` DESC
    `;
    const [rows] = await pool.query(sql, [userId, category]);
    res.json({
      success: true,
      data: rows,
      count: rows.length
    });
  } catch (err) {
    console.error('DB error:', err);
    res.status(500).json({ error: 'Database error', detail: err.message });
  }
});

// 获取所有分类
router.get('/bookmarks/categories', async (req, res) => {
  if (!req.session || !req.session.isAuthenticated) {
    return res.status(401).json({ error: '未登录，请先登录' });
  }

  const userId = req.session.userId;

  try {
    const sql = `
      SELECT DISTINCT \`category\`, COUNT(*) as count 
      FROM \`bookmarks\` 
      WHERE \`user_id\` = ? 
      GROUP BY \`category\`
      ORDER BY \`category\`
    `;
    const [rows] = await pool.query(sql, [userId]);
    res.json({
      success: true,
      data: rows
    });
  } catch (err) {
    console.error('DB error:', err);
    res.status(500).json({ error: 'Database error', detail: err.message });
  }
});

// 添加书签
router.post('/bookmarks', async (req, res) => {
  if (!req.session || !req.session.isAuthenticated) {
    return res.status(401).json({ error: '未登录，请先登录' });
  }

  const userId = req.session.userId;
  const { title, url, icon, description, category, sort_order } = req.body;

  // 验证必填字段
  if (!title || !url) {
    return res.status(400).json({ error: '请提供标题和网址' });
  }

  // 验证URL格式
  try {
    new URL(url);
  } catch (e) {
    return res.status(400).json({ error: '无效的网址格式' });
  }

  try {
    // 如果没有指定sort_order，获取当前最大的sort_order + 1
    let finalSortOrder = sort_order;
    if (finalSortOrder === undefined || finalSortOrder === null) {
      const [maxResult] = await pool.query(
        'SELECT MAX(`sort_order`) as max_order FROM `bookmarks` WHERE `user_id` = ?',
        [userId]
      );
      finalSortOrder = (maxResult[0].max_order || 0) + 1;
    }

    const sql = `
      INSERT INTO \`bookmarks\` 
      (\`user_id\`, \`title\`, \`url\`, \`icon\`, \`description\`, \`category\`, \`sort_order\`) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const [result] = await pool.execute(sql, [
      userId,
      title,
      url,
      icon || null,
      description || null,
      category || '默认',
      finalSortOrder
    ]);

    res.json({
      success: true,
      message: '书签添加成功',
      data: {
        id: result.insertId,
        user_id: userId,
        title,
        url,
        icon: icon || null,
        description: description || null,
        category: category || '默认',
        sort_order: finalSortOrder
      }
    });
  } catch (err) {
    console.error('DB error:', err);
    res.status(500).json({ error: 'Database error', detail: err.message });
  }
});

// 更新书签
router.put('/bookmarks/:id', async (req, res) => {
  if (!req.session || !req.session.isAuthenticated) {
    return res.status(401).json({ error: '未登录，请先登录' });
  }

  const userId = req.session.userId;
  const bookmarkId = req.params.id;
  const { title, url, icon, description, category, sort_order } = req.body;

  // 验证必填字段
  if (!title || !url) {
    return res.status(400).json({ error: '请提供标题和网址' });
  }

  // 验证URL格式
  try {
    new URL(url);
  } catch (e) {
    return res.status(400).json({ error: '无效的网址格式' });
  }

  try {
    // 先检查书签是否存在且属于当前用户
    const [checkRows] = await pool.query(
      'SELECT * FROM `bookmarks` WHERE `id` = ? AND `user_id` = ?',
      [bookmarkId, userId]
    );

    if (checkRows.length === 0) {
      return res.status(404).json({ error: '书签不存在或无权限访问' });
    }

    // 更新书签
    const sql = `
      UPDATE \`bookmarks\` 
      SET \`title\` = ?, \`url\` = ?, \`icon\` = ?, \`description\` = ?, \`category\` = ?, \`sort_order\` = ?
      WHERE \`id\` = ? AND \`user_id\` = ?
    `;
    await pool.execute(sql, [
      title,
      url,
      icon || null,
      description || null,
      category || '默认',
      sort_order !== undefined ? sort_order : checkRows[0].sort_order,
      bookmarkId,
      userId
    ]);

    res.json({
      success: true,
      message: '书签更新成功'
    });
  } catch (err) {
    console.error('DB error:', err);
    res.status(500).json({ error: 'Database error', detail: err.message });
  }
});

// 删除书签
router.delete('/bookmarks/:id', async (req, res) => {
  if (!req.session || !req.session.isAuthenticated) {
    return res.status(401).json({ error: '未登录，请先登录' });
  }

  const userId = req.session.userId;
  const bookmarkId = req.params.id;

  try {
    // 先检查书签是否存在且属于当前用户
    const [checkRows] = await pool.query(
      'SELECT * FROM `bookmarks` WHERE `id` = ? AND `user_id` = ?',
      [bookmarkId, userId]
    );

    if (checkRows.length === 0) {
      return res.status(404).json({ error: '书签不存在或无权限访问' });
    }

    // 删除书签
    const sql = 'DELETE FROM `bookmarks` WHERE `id` = ? AND `user_id` = ?';
    await pool.execute(sql, [bookmarkId, userId]);

    res.json({
      success: true,
      message: '书签删除成功'
    });
  } catch (err) {
    console.error('DB error:', err);
    res.status(500).json({ error: 'Database error', detail: err.message });
  }
});

// 批量更新排序
router.put('/bookmarks/sort', async (req, res) => {
  if (!req.session || !req.session.isAuthenticated) {
    return res.status(401).json({ error: '未登录，请先登录' });
  }

  const userId = req.session.userId;
  const { items } = req.body; // items: [{id: 1, sort_order: 1}, {id: 2, sort_order: 2}, ...]

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: '请提供排序数据' });
  }

  try {
    // 使用事务批量更新
    await pool.query('START TRANSACTION');
    
    for (const item of items) {
      const { id, sort_order } = item;
      // 验证书签属于当前用户
      const [checkRows] = await pool.query(
        'SELECT * FROM `bookmarks` WHERE `id` = ? AND `user_id` = ?',
        [id, userId]
      );
      
      if (checkRows.length > 0) {
        await pool.execute(
          'UPDATE `bookmarks` SET `sort_order` = ? WHERE `id` = ? AND `user_id` = ?',
          [sort_order, id, userId]
        );
      }
    }
    
    await pool.query('COMMIT');
    
    res.json({
      success: true,
      message: '排序更新成功'
    });
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('DB error:', err);
    res.status(500).json({ error: 'Database error', detail: err.message });
  }
});

module.exports = router;





