const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  getAuthUrl,
  handleGoogleCallback,
  getCurrentUser,
  logout
} = require('../controllers/authController');

// Get Google OAuth URL
router.get('/google', getAuthUrl);

// Google OAuth callback
router.get('/google/callback', handleGoogleCallback);

// Get current user (protected route)
router.get('/me', authenticate, getCurrentUser);

// Logout
router.post('/logout', authenticate, logout);

module.exports = router;
