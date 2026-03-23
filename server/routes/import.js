const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authenticate } = require('../middleware/auth');
const { parseImportFile, executeImport } = require('../controllers/importController');

// Configure multer for file uploads
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const extension = file.originalname.split('.').pop().toLowerCase();
  if (extension === 'csv' || extension === 'json') {
    cb(null, true);
  } else {
    cb(new Error('Only .csv and .json files are allowed'), false);
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter,
});

// All routes require authentication
router.use(authenticate);

// Parse uploaded file and return columns, rows, suggested mappings
router.post('/parse', (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}, parseImportFile);

// Execute import with mapped data
router.post('/execute', executeImport);

module.exports = router;
