const jwt = require('jsonwebtoken');
const { google } = require('googleapis');
const { pool } = require('../config/database');
const { oauth2Client, SCOPES } = require('../config/google');

// Generate authorization URL for Google OAuth
const getAuthUrl = (req, res) => {
  try {
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent' // Force to get refresh token
    });

    res.json({ authUrl });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    res.status(500).json({
      error: 'Failed to generate authorization URL',
      message: error.message
    });
  }
};

// Handle Google OAuth callback
const handleGoogleCallback = async (req, res) => {
  try {
    const { code } = req.query;

    if (!code) {
      return res.status(400).json({
        error: 'Authorization code is required'
      });
    }

    // Exchange authorization code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user info from Google
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data } = await oauth2.userinfo.get();

    // Check if user exists in database
    let userResult = await pool.query(
      'SELECT * FROM users WHERE google_id = $1',
      [data.id]
    );

    let user;

    if (userResult.rows.length === 0) {
      // Create new user
      const insertResult = await pool.query(
        `INSERT INTO users (google_id, email, name, picture, access_token, refresh_token, token_expiry, last_login)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         RETURNING id, google_id, email, name, picture, created_at`,
        [
          data.id,
          data.email,
          data.name,
          data.picture,
          tokens.access_token,
          tokens.refresh_token,
          tokens.expiry_date ? new Date(tokens.expiry_date) : null
        ]
      );
      user = insertResult.rows[0];
    } else {
      // Update existing user with new tokens
      const updateResult = await pool.query(
        `UPDATE users
         SET access_token = $1,
             refresh_token = COALESCE($2, refresh_token),
             token_expiry = $3,
             last_login = NOW(),
             picture = $4,
             name = $5
         WHERE google_id = $6
         RETURNING id, google_id, email, name, picture, created_at`,
        [
          tokens.access_token,
          tokens.refresh_token,
          tokens.expiry_date ? new Date(tokens.expiry_date) : null,
          data.picture,
          data.name,
          data.id
        ]
      );
      user = updateResult.rows[0];
    }

    // Generate JWT token
    const jwtToken = jwt.sign(
      {
        id: user.id,
        email: user.email,
        name: user.name
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Redirect to frontend with token
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/auth/callback?token=${jwtToken}`);

  } catch (error) {
    console.error('Error in Google callback:', error);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/auth/error?message=${encodeURIComponent(error.message)}`);
  }
};

// Get current user info
const getCurrentUser = async (req, res) => {
  try {
    const userResult = await pool.query(
      'SELECT id, google_id, email, name, picture, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    res.json({ user: userResult.rows[0] });
  } catch (error) {
    console.error('Error getting current user:', error);
    res.status(500).json({
      error: 'Failed to get user information',
      message: error.message
    });
  }
};

// Logout user
const logout = (req, res) => {
  // Client should remove the JWT token
  // Optionally, revoke Google tokens here
  res.json({ message: 'Logged out successfully' });
};

module.exports = {
  getAuthUrl,
  handleGoogleCallback,
  getCurrentUser,
  logout
};
