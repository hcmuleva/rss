/**
 * =====================================================================
 * Admin Activities Routes
 * Company: emeelan
 * =====================================================================
 */

const express = require('express');
const router = express.Router();
const adminActivitiesController = require('../controllers/adminActivitiesController');
const { protect } = require('../middleware/auth');
const { isSuperAdmin } = require('../middleware/admin');

// Get detailed activities for a user (superadmin only)
router.get('/:userId', protect, isSuperAdmin, adminActivitiesController.getUserActivities);

module.exports = router;
