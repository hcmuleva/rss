/**
 * =====================================================================
 * Admin Invoice Routes
 * Company: emeelan
 * =====================================================================
 */

const express = require('express');
const router = express.Router();
const {
  getAdminInvoices,
  getAllInvoices,
  updateInvoice
} = require('../controllers/invoiceController');
const { protect } = require('../middleware/auth');
const { isAdmin } = require('../middleware/admin');

// Admin routes (protected + admin)
router.get('/created', protect, isAdmin, getAdminInvoices);
router.get('/all', protect, isAdmin, getAllInvoices);
router.put('/:id', protect, isAdmin, updateInvoice);

module.exports = router;
