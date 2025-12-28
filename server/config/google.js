const { google } = require('googleapis');
require('dotenv').config();

// OAuth2 client configuration
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID?.trim(),
  process.env.GOOGLE_CLIENT_SECRET?.trim(),
  process.env.GOOGLE_REDIRECT_URI?.trim()
);

// Scopes required for the application
const SCOPES = [
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/contacts.readonly',
  'https://www.googleapis.com/auth/drive.readonly', // Changed from drive.file to drive.readonly for browsing files and shared drives
  'https://www.googleapis.com/auth/gmail.readonly',
];

module.exports = {
  oauth2Client,
  SCOPES,
};
