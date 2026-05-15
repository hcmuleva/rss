/**
 * =====================================================================
 * Temple Teams Routes
 * Company: emeelan
 * Description: API routes for temple teams/groups management
 * =====================================================================
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const templeTeamsController = require('../controllers/templeTeamsController');

// All routes require authentication
router.use(protect);

// Users search
router.get('/users/search', templeTeamsController.searchUsers);

// Temple settings
router.put('/temple/:templeId/visible-groups', templeTeamsController.updateTempleVisibleGroups);

// Groups
router.get('/groups', templeTeamsController.getAllGroups);
router.put('/groups/:groupId/settings', templeTeamsController.updateGroupSettings);
router.put('/groups/:groupId/photo', templeTeamsController.updateGroupPhoto);
router.get('/groups/:groupId/categories', templeTeamsController.getGroupCategories);

// Members
router.get('/groups/:groupId/members', templeTeamsController.getGroupMembers);
router.post('/groups/:groupId/members', templeTeamsController.addGroupMembers);
router.post('/groups/members', templeTeamsController.addMemberWithRoles); // Simplified - add member with multiple roles
router.delete('/groups/:groupId/members/:memberId', templeTeamsController.removeGroupMember);

// Messages
router.get('/groups/:groupId/messages', templeTeamsController.getGroupMessages);
router.post('/groups/:groupId/messages', templeTeamsController.sendGroupMessage);

// Events
router.get('/groups/:groupId/events', templeTeamsController.getGroupEvents);
router.post('/groups/:groupId/events', templeTeamsController.createGroupEvent);

// Documents
router.get('/groups/:groupId/documents', templeTeamsController.getGroupDocuments);
router.post('/groups/:groupId/documents', templeTeamsController.uploadGroupDocuments);

module.exports = router;
