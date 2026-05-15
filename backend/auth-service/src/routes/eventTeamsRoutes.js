/**
 * =====================================================================
 * Event Teams Routes
 * Company: emeelan
 * =====================================================================
 * API routes for team management
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const eventTeamsController = require('../controllers/eventTeamsController');

// All routes require authentication
router.use(protect);

// Occurrence teams
router.get('/occurrences/:id/teams', eventTeamsController.getOccurrenceTeams);
router.post('/occurrences/:id/teams', eventTeamsController.createTeam);

// Team operations
router.post('/teams/:id/join', eventTeamsController.joinTeam);
router.post('/teams/:id/leave', eventTeamsController.leaveTeam);
router.get('/teams/:id/members', eventTeamsController.getTeamMembers);
router.delete('/teams/:id/members/:userId', eventTeamsController.removeMember);
router.delete('/teams/:id', eventTeamsController.deleteTeam);

module.exports = router;
