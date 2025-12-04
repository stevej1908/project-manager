const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  getProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  shareProject,
  removeProjectMember
} = require('../controllers/projectController');

// All routes require authentication
router.use(authenticate);

// Project CRUD
router.get('/', getProjects);
router.get('/:id', getProjectById);
router.post('/', createProject);
router.put('/:id', updateProject);
router.delete('/:id', deleteProject);

// Project sharing
router.post('/:id/share', shareProject);
router.delete('/:id/members/:memberId', removeProjectMember);

module.exports = router;
