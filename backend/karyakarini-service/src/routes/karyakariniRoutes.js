const express = require('express');
const controller = require('../controllers/karyakariniController');
const { requireAdmin, requireSuperAdmin, verifyToken } = require('../middleware/auth');
const upload = require('../config/multer');

const router = express.Router();

router.use(verifyToken);

router.get('/versions', controller.getVersions);
router.post('/versions', requireSuperAdmin, controller.createVersion);

router.get('/tree', controller.getTree);
router.post('/nodes', requireAdmin, controller.createNode);
router.put('/nodes/:nodeId', requireAdmin, controller.updateNode);
router.get('/nodes/assignable', controller.getAssignableNodes);
router.get('/nodes/members', controller.getNodeMembersDirect);

router.get('/members', controller.getMembers);
router.get('/members/search-users', controller.searchUsers);
router.get('/pads', controller.getPadOptions);
router.post('/member', requireAdmin, controller.createMember);
router.post('/member-with-user', requireAdmin, controller.createMemberWithUserMapping);
router.get('/guests/search', controller.searchGuests);
router.post('/guests', controller.createGuest);

router.get('/meetings', controller.getMeetings);
router.post('/meetings', controller.createMeeting);
router.get('/meetings/:meetingId', controller.getMeetingDetails);
router.put('/meetings/:meetingId', controller.updateMeeting);
router.get('/tasks', controller.getTasks);
router.post('/tasks', controller.createTask);
router.get('/my/teams', controller.getMyTeams);
router.get('/my/tasks', controller.getMyTasks);
router.get('/my/invitations', controller.getMyInvitations);
router.get('/my/invitations/sent-summary', controller.getMySentInvitationsSummary);
router.post('/my/invitations/read', controller.markMyInvitationsRead);
router.patch('/my/invitations/:invitationId/respond', controller.respondToInvitation);
router.post('/upload/attachment', upload.single('file'), controller.uploadAttachment);

router.get('/scopes', requireAdmin, controller.getScopes);
router.post('/scopes', requireAdmin, controller.upsertScope);

module.exports = router;
