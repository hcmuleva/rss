/**
 * =====================================================================
 * Invoice Controller
 * Company: emeelan
 * =====================================================================
 */

const Invoice = require('../models/Invoice');
const User = require('../models/User');

/**
 * @route   GET /api/invoices/my
 * @desc    Get current user's invoices
 * @access  Private
 */
const getMyInvoices = async (req, res) => {
  try {
    const userId = req.user.id;
    const invoices = await Invoice.findByUserId(userId);

    res.status(200).json({
      success: true,
      data: {
        invoices,
        total: invoices.length
      }
    });
  } catch (error) {
    console.error('Get my invoices error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get invoices'
    });
  }
};

/**
 * @route   GET /api/admin/invoices
 * @desc    Get invoices created by admin
 * @access  Admin
 */
const getAdminInvoices = async (req, res) => {
  try {
    const adminId = req.user.id;
    const invoices = await Invoice.findByCreatedBy(adminId);

    res.status(200).json({
      success: true,
      data: {
        invoices,
        total: invoices.length
      }
    });
  } catch (error) {
    console.error('Get admin invoices error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get invoices'
    });
  }
};

/**
 * @route   GET /api/invoices/:id
 * @desc    Get single invoice by ID
 * @access  Private
 */
const getInvoiceById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const invoice = await Invoice.findById(id);

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    // Check if user has access to this invoice
    if (invoice.user_id !== userId && invoice.created_by !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        invoice
      }
    });
  } catch (error) {
    console.error('Get invoice error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get invoice'
    });
  }
};

/**
 * @route   GET /api/invoices/number/:invoiceNumber
 * @desc    Get invoice by invoice number
 * @access  Private
 */
const getInvoiceByNumber = async (req, res) => {
  try {
    const { invoiceNumber } = req.params;
    const userId = req.user.id;

    const invoice = await Invoice.findByInvoiceNumber(invoiceNumber);

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    // Check if user has access to this invoice
    if (invoice.user_id !== userId && invoice.created_by !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        invoice
      }
    });
  } catch (error) {
    console.error('Get invoice by number error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get invoice'
    });
  }
};

/**
 * @route   GET /api/admin/invoices/all
 * @desc    Get all invoices with filters (admin only)
 * @access  Admin
 */
const getAllInvoices = async (req, res) => {
  try {
    const { payment_status, payment_method, start_date, end_date, limit } = req.query;

    const filters = {};
    if (payment_status) filters.payment_status = payment_status;
    if (payment_method) filters.payment_method = payment_method;
    if (start_date) filters.start_date = start_date;
    if (end_date) filters.end_date = end_date;
    if (limit) filters.limit = parseInt(limit);

    const invoices = await Invoice.findAll(filters);

    res.status(200).json({
      success: true,
      data: {
        invoices,
        total: invoices.length,
        filters
      }
    });
  } catch (error) {
    console.error('Get all invoices error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get invoices'
    });
  }
};

/**
 * @route   PUT /api/admin/invoices/:id
 * @desc    Update invoice (admin only)
 * @access  Admin
 */
const updateInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const { payment_status, transaction_id, notes } = req.body;

    const invoice = await Invoice.update(id, {
      payment_status,
      transaction_id,
      notes
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Invoice updated successfully',
      data: {
        invoice
      }
    });
  } catch (error) {
    console.error('Update invoice error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update invoice'
    });
  }
};

module.exports = {
  getMyInvoices,
  getAdminInvoices,
  getInvoiceById,
  getInvoiceByNumber,
  getAllInvoices,
  updateInvoice
};
