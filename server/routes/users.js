const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { pool } = require('../config/database');

// All routes require authentication
router.use(authenticate);

// Search users by email (for sharing projects)
router.get('/search', async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ error: 'Email query parameter is required' });
    }

    const result = await pool.query(
      'SELECT id, email, name, picture FROM users WHERE email ILIKE $1 LIMIT 10',
      [`%${email}%`]
    );

    res.json({ users: result.rows });
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({
      error: 'Failed to search users',
      message: error.message
    });
  }
});

module.exports = router;
