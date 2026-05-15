/**
 * =====================================================================
 * Education Routes
 * Company: emeelan
 * Description: User education management routes (Education Tab)
 * =====================================================================
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getAllEducation,
  addEducation,
  updateEducation,
  deleteEducation,
} = require('../controllers/educationController');

// All routes require authentication
router.get('/', protect, getAllEducation);
router.post('/', protect, addEducation);
router.put('/:id', protect, updateEducation);
router.delete('/:id', protect, deleteEducation);

module.exports = router;
