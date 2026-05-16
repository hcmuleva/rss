/**
 * =====================================================================
 * Business Routes
 * Company: emeelan
 * Description: User business management routes (Business Tab)
 * =====================================================================
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getAllBusiness,
  addBusiness,
  updateBusiness,
  deleteBusiness,
} = require('../controllers/businessController');

// All routes require authentication
router.get('/', protect, getAllBusiness);
router.post('/', protect, addBusiness);
router.put('/:id', protect, updateBusiness);
router.delete('/:id', protect, deleteBusiness);

module.exports = router;
