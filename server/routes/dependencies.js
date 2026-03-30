const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  getDependencies,
  createDependency,
  updateDependency,
  deleteDependency,
  getTaskDependencies,
  getCrossProjectDependencies
} = require('../controllers/dependencyController');

// All routes require authentication
router.use(authenticate);

// Cross-project dependencies (must be before /:id routes)
router.get('/cross-project', getCrossProjectDependencies);

// Named routes must be before /:id to avoid shadowing
router.get('/task/:taskId', getTaskDependencies);

// Dependency CRUD
router.get('/', getDependencies);
router.post('/', createDependency);
router.put('/:id', updateDependency);
router.delete('/:id', deleteDependency);

module.exports = router;
