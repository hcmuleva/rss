/**
 * =====================================================================
 * Jobs Routes
 * Company: emeelan
 * Description: User jobs/employment management routes (Jobs Tab)
 * =====================================================================
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getAllJobs,
  addJob,
  updateJob,
  deleteJob,
} = require('../controllers/jobsController');

// All routes require authentication
router.get('/', protect, getAllJobs);
router.post('/', protect, addJob);
router.put('/:id', protect, updateJob);
router.delete('/:id', protect, deleteJob);

module.exports = router;
