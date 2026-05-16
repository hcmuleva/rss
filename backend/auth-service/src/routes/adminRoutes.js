/**
 * =====================================================================
 * Admin Routes
 * Company: emeelan
 * =====================================================================
 */

const express = require('express');
const router = express.Router();
const {
  getAllUsers,
  updateUserRole,
  createUser,
  getPaginatedUsers,
  searchUsers,
  createTempleAdmin,
} = require('../controllers/adminController');
const { protect } = require('../middleware/auth');
const { isAdmin, isSuperAdmin } = require('../middleware/admin');
const { checkLevelAccess, injectJurisdictionFilters } = require('../middleware/rbacMiddleware');

// All admin routes require authentication
router.use(protect);

// Admin routes (admin + superadmin)
router.get('/users', isAdmin, injectJurisdictionFilters, getAllUsers);
router.get('/users/paginated', isAdmin, injectJurisdictionFilters, getPaginatedUsers);
router.get('/users/search', isAdmin, injectJurisdictionFilters, searchUsers);
router.post('/users', isAdmin, checkLevelAccess, createUser);

// SuperAdmin only routes
router.put('/users/:userId/role', isSuperAdmin, updateUserRole);

// Create temple admin user
router.post('/create-temple-admin', protect, isSuperAdmin, createTempleAdmin);

module.exports = router;
