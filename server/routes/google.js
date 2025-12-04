const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  getContacts,
  searchContacts,
  getGmailMessages,
  getGmailMessage,
  attachDriveFile,
  listDriveFiles
} = require('../controllers/googleController');

// All routes require authentication
router.use(authenticate);

// Contacts
router.get('/contacts', getContacts);
router.get('/contacts/search', searchContacts);

// Gmail
router.get('/gmail/messages', getGmailMessages);
router.get('/gmail/messages/:messageId', getGmailMessage);

// Drive
router.get('/drive/files', listDriveFiles);
router.post('/drive/attach', attachDriveFile);

module.exports = router;
