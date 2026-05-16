/**
 * =====================================================================
 * Subscriptions Routes
 * Company: emeelan
 * =====================================================================
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { isAdmin } = require('../middleware/admin');
const {
  createSubscription,
  createBatchSubscriptions,
  getMySubscriptions,
  getAllSubscriptions,
  cancelMySubscription,
  cancelMySubscriptionByService
} = require('../controllers/subscriptionsController');

// Enhanced controller with membership & rewards integration
const {
  createEnhancedSubscription,
  createBatchEnhancedSubscriptions,
  getMyEnhancedSubscriptions
} = require('../controllers/subscriptionsControllerEnhanced');

// =====================================================================
// ENHANCED ROUTES (With Membership Discounts & Points)
// =====================================================================

/**
 * @route   POST /api/subscriptions/enhanced
 * @desc    Create subscription with membership discounts and points
 * @access  Private
 */
router.post('/enhanced', protect, createEnhancedSubscription);

/**
 * @route   POST /api/subscriptions/batch-enhanced
 * @desc    Batch subscription with discounts and points
 * @access  Private
 */
router.post('/batch-enhanced', protect, createBatchEnhancedSubscriptions);

/**
 * @route   GET /api/subscriptions/my-enhanced
 * @desc    Get subscriptions with points & membership info
 * @access  Private
 */
router.get('/my-enhanced', protect, getMyEnhancedSubscriptions);

// =====================================================================
// ORIGINAL ROUTES (Backward Compatibility)
// =====================================================================

// Protected routes (user must be logged in)
router.get('/my', protect, getMySubscriptions);
router.delete('/service/:serviceId', protect, cancelMySubscriptionByService);
router.delete('/:subscriptionId', protect, cancelMySubscription);
router.post('/', protect, createSubscription);
router.post('/batch', protect, createBatchSubscriptions);

// Admin routes
router.get('/all', protect, isAdmin, getAllSubscriptions);

module.exports = router;
