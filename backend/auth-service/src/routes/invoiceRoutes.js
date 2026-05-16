/**
 * =====================================================================
 * Invoice Routes
 * Company: emeelan
 * =====================================================================
 */

const express = require('express');
const router = express.Router();
const {
  getMyInvoices,
  getAdminInvoices,
  getInvoiceById,
  getInvoiceByNumber,
  getAllInvoices,
  updateInvoice
} = require('../controllers/invoiceController');
const { protect } = require('../middleware/auth');
const { isAdmin } = require('../middleware/admin');

// User routes (protected)
router.get('/my', protect, getMyInvoices);
router.get('/number/:invoiceNumber', protect, getInvoiceByNumber);
router.get('/:id', protect, getInvoiceById);

module.exports = router;
