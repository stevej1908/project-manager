const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  getDependencies,
  createDependency,
  updateDependency,
  deleteDependency,
  getTaskDependencies
} = require('../controllers/dependencyController');

// All routes require authentication
router.use(authenticate);

// Dependency CRUD
router.get('/', getDependencies);
router.post('/', createDependency);
router.put('/:id', updateDependency);
router.delete('/:id', deleteDependency);

// Get dependencies for a specific task
router.get('/task/:taskId', getTaskDependencies);

module.exports = router;
