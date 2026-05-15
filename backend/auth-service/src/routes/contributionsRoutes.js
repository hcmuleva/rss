/**
 * =====================================================================
 * Contributions Routes
 * Company: emeelan
 * =====================================================================
 * Routes for admin contribution tracking and leaderboard
 */

const express = require('express');
const router = express.Router();
const contributionsController = require('../controllers/contributionsController');
const { protect } = require('../middleware/auth');
const { isAdmin } = require('../middleware/admin');

// Get user contributions (own or specific user)
router.get('/contributions/:userId', protect, contributionsController.getUserContributions);

// Get leaderboard
router.get('/leaderboard', protect, isAdmin, contributionsController.getLeaderboard);

// Get temple admin stats
router.get('/temples/:id/admin-stats', protect, isAdmin, contributionsController.getTempleAdminStats);

module.exports = router;
