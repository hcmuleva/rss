/**
 * =====================================================================
 * Family Routes
 * Company: emeelan
 * =====================================================================
 */

const express = require('express');
const router = express.Router();
const familyController = require('../controllers/familyController');
const { protect } = require('../middleware/auth');
const { isAdmin } = require('../middleware/admin');

// Protected routes - Require authentication
router.get('/families', protect, familyController.getFamilies);
router.get('/families/search', protect, familyController.searchFamilies);  // Must be before /:identifier
router.get('/families/:id/heads', protect, familyController.getFamilyHeads);
router.put('/families/:id/heads', protect, isAdmin, familyController.updateFamilyHeads);
router.put('/families/:id/head', protect, isAdmin, familyController.updateSingleFamilyHead);
router.get('/families/:identifier', protect, familyController.getFamily);
router.get('/families/:id/members', protect, familyController.getFamilyMembers);

// Create family - Admin/SuperAdmin only (with temple context)
router.post('/families', protect, isAdmin, familyController.createFamily);

// Update family
router.put('/families/:id', protect, familyController.updateFamily);

// Family member management
router.post('/families/:familyId/members', protect, isAdmin, familyController.addFamilyMember);

// Family temple associations
router.post('/families/:familyId/temples', protect, isAdmin, familyController.addTempleToFamily);
router.delete('/families/:familyId/temples/:templeId', protect, isAdmin, familyController.removeTempleFromFamily);

// Temple assignment for admin panel
router.post('/families/:id/assign-temple', protect, isAdmin, familyController.assignTemple);
router.post('/families/:id/unassign-temple', protect, isAdmin, familyController.unassignTemple);

module.exports = router;
