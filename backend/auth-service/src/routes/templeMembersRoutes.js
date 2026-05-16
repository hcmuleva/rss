/**
 * =====================================================================
 * Temple Members Routes
 * Company: emeelan
 * =====================================================================
 * Routes for managing temple membership
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const templeMembersController = require('../controllers/templeMembersController');

// All routes require authentication
router.use(protect);

// Global user search (phone/email across all temples)
router.get('/search-global', templeMembersController.searchGlobalUsers);

// Get all members of a temple
router.get('/', templeMembersController.getTempleMembers);

// Add member to temple
router.post('/add-to-temple', templeMembersController.addMemberToTemple);

// Update member in temple
router.put('/:userId', templeMembersController.updateMemberInTemple);

// Remove member from temple
router.delete('/:userId', templeMembersController.removeMemberFromTemple);

module.exports = router;
