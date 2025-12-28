const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  getContacts,
  searchContacts,
  getGmailMessages,
  getGmailMessage,
  attachDriveFile,
  listDriveFiles,
  listSharedDrives,
  attachEmailToTask,
  getTaskEmails,
  deleteTaskEmail
} = require('../controllers/googleController');

// All routes require authentication
router.use(authenticate);

// Contacts
router.get('/contacts', getContacts);
router.get('/contacts/search', searchContacts);

// Gmail
router.get('/gmail/messages', getGmailMessages);
router.get('/gmail/messages/:messageId', getGmailMessage);

// Email attachments
router.post('/gmail/attach', attachEmailToTask);
router.get('/gmail/task/:taskId/emails', getTaskEmails);
router.delete('/gmail/emails/:emailId', deleteTaskEmail);

// Drive
router.get('/drive/files', listDriveFiles);
router.get('/drive/shared-drives', listSharedDrives);
router.post('/drive/attach', attachDriveFile);

module.exports = router;
