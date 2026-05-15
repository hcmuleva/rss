const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { isAdmin } = require('../middleware/admin');
const {
  getCategories,
  listAnnouncements,
  createAnnouncement,
  listAnnouncementComments,
  createAnnouncementComment,
} = require('../controllers/announcementsController');

router.use(protect);

router.get('/categories', getCategories);
router.get('/', listAnnouncements);
router.post('/', isAdmin, createAnnouncement);
router.get('/:announcementId/comments', listAnnouncementComments);
router.post('/:announcementId/comments', createAnnouncementComment);

module.exports = router;
