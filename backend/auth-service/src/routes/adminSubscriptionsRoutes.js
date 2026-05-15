/**
 * =====================================================================
 * Admin Subscriptions Routes
 * Company: emeelan
 * =====================================================================
 */

const express = require('express');
const router = express.Router();
const {
  assignSubscription,
  getUserSubscriptions,
  cancelSubscription
} = require('../controllers/adminSubscriptionsController');
const { protect } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// Admin assign subscription to user
router.post('/assign', assignSubscription);

// Get user's subscriptions (admin view)
router.get('/user/:userId', getUserSubscriptions);

// Cancel subscription
router.delete('/:subscriptionId', cancelSubscription);

module.exports = router;
