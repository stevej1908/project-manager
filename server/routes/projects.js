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
  removeProjectMember,
  getProjectChildren,
  getProjectTree,
  reorderProjects
} = require('../controllers/projectController');

// All routes require authentication
router.use(authenticate);

// Project CRUD
router.get('/', getProjects);
router.post('/', createProject);

// Project hierarchy
router.get('/:id/children', getProjectChildren);
router.get('/:id/tree', getProjectTree);
router.put('/:id/reorder', reorderProjects);

// Single project
router.get('/:id', getProjectById);
router.put('/:id', updateProject);
router.delete('/:id', deleteProject);

// Project sharing
router.post('/:id/share', shareProject);
router.delete('/:id/members/:memberId', removeProjectMember);

module.exports = router;
