const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  getProjectDependencies,
  createProjectDependency,
  updateProjectDependency,
  deleteProjectDependency
} = require('../controllers/projectDependencyController');

// All routes require authentication
router.use(authenticate);

router.get('/', getProjectDependencies);
router.post('/', createProjectDependency);
router.put('/:id', updateProjectDependency);
router.delete('/:id', deleteProjectDependency);

module.exports = router;
