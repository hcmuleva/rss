/**
 * =====================================================================
 * Coupons Routes
 * Company: emeelan
 * =====================================================================
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { isAdmin } = require('../middleware/admin');
const {
  validateCoupon,
  getAllCoupons
} = require('../controllers/couponsController');

// Public routes
router.post('/validate', validateCoupon);

// Admin routes
router.get('/', protect, isAdmin, getAllCoupons);

module.exports = router;
