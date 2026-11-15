const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
  addComment,
  deleteAttachment,
  addAssignee,
  removeAssignee
} = require('../controllers/taskController');
const { getTaskPrivacy, setTaskPrivacy } = require('../controllers/privacyController');

// All routes require authentication
router.use(authenticate);

// Task CRUD
router.get('/', getTasks);
router.get('/:id/privacy', getTaskPrivacy);
router.put('/:id/privacy', setTaskPrivacy);
router.get('/:id', getTaskById);
router.post('/', createTask);
router.put('/:id', updateTask);
router.delete('/:id', deleteTask);

// Comments
router.post('/:id/comments', addComment);

// Attachments
router.delete('/attachments/:attachmentId', deleteAttachment);

// Assignees
router.post('/:id/assignees', addAssignee);
router.delete('/:id/assignees/:assigneeId', removeAssignee);

module.exports = router;
