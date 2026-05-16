const express = require('express');
const multer = require('multer');
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
router.put('/member/:memberId', requireAdmin, controller.updateMember);
router.post('/member-with-user', requireAdmin, controller.createMemberWithUserMapping);
router.get('/guests/search', controller.searchGuests);
router.post('/guests', controller.createGuest);

router.get('/meetings', controller.getMeetings);
router.post('/meetings', controller.createMeeting);
router.get('/meetings/:meetingId', controller.getMeetingDetails);
router.put('/meetings/:meetingId', controller.updateMeeting);
router.get('/tasks', controller.getTasks);
router.post('/tasks', controller.createTask);
router.put('/tasks/:taskId', controller.updateTask);
router.patch('/my/tasks/:taskId/status', controller.updateMyTaskStatus);
router.get('/my/teams', controller.getMyTeams);
router.get('/my/report/members', controller.getReportMembers);
router.post('/my/category-activities', controller.createMyCategoryActivity);
router.get('/my/category-activities', controller.getMyCategoryActivities);
router.get('/category-activities', controller.getCategoryActivities);
router.get('/my/tasks', controller.getMyTasks);
router.get('/my/notifications', controller.getMyNotifications);
router.get('/my/notifications/unread-count', controller.getMyNotificationUnreadCount);
router.post('/my/notifications/read', controller.markMyNotificationsRead);
router.get('/my/invitations', controller.getMyInvitations);
router.get('/my/invitations/sent-summary', controller.getMySentInvitationsSummary);
router.post('/my/invitations/read', controller.markMyInvitationsRead);
router.patch('/my/invitations/:invitationId/respond', controller.respondToInvitation);
router.post('/upload/attachment', (req, res, next) => {
  upload.single('file')(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File size must be 30MB or less',
      });
    }
    if (String(error?.message || '').toLowerCase().includes('unsupported file type')) {
      return res.status(400).json({
        success: false,
        message: 'Unsupported file type. Please upload image or supported document',
      });
    }
    return res.status(400).json({
      success: false,
      message: error?.message || 'Failed to process attachment upload',
    });
  });
}, controller.uploadAttachment);

router.get('/scopes', requireAdmin, controller.getScopes);
router.post('/scopes', requireAdmin, controller.upsertScope);

module.exports = router;
