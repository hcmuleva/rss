/**
 * =====================================================================
 * Trustees Routes
 * Company: emeelan
 * =====================================================================
 * API routes for temple trustees management
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const trusteesController = require('../controllers/trusteesController');
const upload = require('../config/multer');

// All routes require authentication
router.use(protect);

// Search members for adding as trustee (3-tier search)
router.get('/search-members', trusteesController.searchMembersForTrustee);

// Get all trustees for a temple
router.get('/', trusteesController.getAllTrustees);

// Get single trustee
router.get('/:id', trusteesController.getTrusteeById);

// Create new trustee
router.post('/', trusteesController.createTrustee);

// Upload trustee photo
router.post('/:id/photo', upload.single('photo'), trusteesController.uploadTrusteePhoto);

module.exports = router;
