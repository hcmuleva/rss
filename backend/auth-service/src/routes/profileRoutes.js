/**
 * =====================================================================
 * Profile Routes
 * Company: emeelan
 * Description: User profile management routes (Basic Info Tab)
 * =====================================================================
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const upload = require('../config/multer');
const {
  getBasicProfile,
  updateBasicProfile,
  uploadProfilePhotoHandler,
  deleteProfilePhoto,
  changePassword,
  checkEmailAvailability,
  resolveMemberUser,
  getUserBySlug,
  getProfessionAggregation,
  getProfessionMembers,
} = require('../controllers/profileController');

// Public routes (Phase 1: Slug ID migration)
router.get('/by-slug/:slug', getUserBySlug);

// Protected routes - All require authentication
router.get('/basic', protect, getBasicProfile);
router.put('/basic', protect, updateBasicProfile);
router.post('/photo', protect, upload.single('photo'), uploadProfilePhotoHandler);
router.delete('/photo', protect, deleteProfilePhoto);
router.post('/change-password', protect, changePassword);
router.get('/check-email', protect, checkEmailAvailability);
router.get('/resolve-member', protect, resolveMemberUser);
router.get('/professions/aggregation', protect, getProfessionAggregation);
router.get('/professions/:professionSlug/members', protect, getProfessionMembers);

module.exports = router;
