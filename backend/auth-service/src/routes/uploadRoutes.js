/**
 * =====================================================================
 * Upload Routes
 * Company: emeelan
 * =====================================================================
 */

const express = require('express');
const router = express.Router();
const upload = require('../config/multer');
const { protect } = require('../middleware/auth');
const { isAdmin } = require('../middleware/admin');
const { uploadPhoto, uploadDocument } = require('../controllers/uploadController');

/**
 * @route   POST /api/upload/photo
 * @desc    Upload photo to S3 (generic - accepts folder parameter)
 * @access  Private
 * @body    { folder: 'temples' | 'profiles' | 'lineages' | etc }
 */
router.post('/photo', protect, upload.single('photo'), uploadPhoto);

/**
 * @route   POST /api/upload/document
 * @desc    Upload document to S3 (generic - accepts folder parameter)
 * @access  Private
 * @body    { folder: 'documents' | etc }
 */
router.post('/document', protect, upload.single('document'), uploadDocument);

/**
 * @route   POST /api/upload/test
 * @desc    Test upload endpoint without auth (for testing only)
 * @access  Public
 */
router.post('/test', upload.single('file'), uploadPhoto);

module.exports = router;
