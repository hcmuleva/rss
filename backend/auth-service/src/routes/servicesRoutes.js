/**
 * =====================================================================
 * Services Routes
 * Company: emeelan
 * =====================================================================
 */

const express = require('express');
const router = express.Router();
const { optionalAuth } = require('../middleware/optionalAuth');
const {
  getAllServices,
  getServiceBySlug,
  getServicesByCategory
} = require('../controllers/servicesController');

// Public routes with optional auth - order matters! More specific routes first
router.get('/category/:category', optionalAuth, getServicesByCategory);
router.get('/:slug', optionalAuth, getServiceBySlug);
router.get('/', optionalAuth, getAllServices);

module.exports = router;
