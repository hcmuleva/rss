/**
 * =====================================================================
 * Admin Subscriptions Controller
 * Company: emeelan
 * =====================================================================
 * Handle admin assigning subscriptions to family members
 */

const Subscription = require('../models/Subscription');
const Service = require('../models/Service');
const Invoice = require('../models/Invoice');
const User = require('../models/User');
const pool = require('../config/database');

/**
 * @route   POST /api/admin/subscriptions/assign
 * @desc    Admin assigns subscription to a user (family member)
 * @access  Admin only
 */
const assignSubscription = async (req, res) => {
  try {
    const adminId = req.user.id; // Admin making the assignment
    const { user_id, service_ids, payment_method, coupon_code, amount_paid } = req.body;

    console.log('📦 Admin subscription assignment:', {
      admin: adminId,
      user: user_id,
      services: service_ids,
      payment_method,
      amount: amount_paid
    });

    // Validate input
    if (!user_id || !service_ids || !Array.isArray(service_ids) || service_ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'User ID and service IDs are required'
      });
    }

    // Check if admin has permission (temple admin check)
    // TODO: Add proper role check once role system is implemented
    
    // Get service details
    const services = await Promise.all(
      service_ids.map(id => Service.findById(id))
    );

    // Verify all services exist
    if (services.some(s => !s)) {
      return res.status(404).json({
        success: false,
        message: 'One or more services not found'
      });
    }

    // Get user details
    const user = await User.findById(user_id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get admin details
    const admin = await User.findById(adminId);

    // Calculate totals
    const subtotal = services.reduce((sum, service) => sum + parseFloat(service.price), 0);
    const discount_amount = 0; // TODO: Calculate from coupon
    const total_amount = subtotal - discount_amount;

    // Create subscriptions for each service
    const subscriptions = [];
    const line_items = [];
    
    for (const service of services) {
      const subscriptionData = {
        user_id: user_id,
        service_id: service.id,
        payment_method: payment_method || 'cash',
        payment_status: 'completed', // Admin pays immediately
        amount_paid: parseFloat(service.price),
        discount_amount: 0,
        coupon_code: coupon_code || null,
        subscribed_by: adminId, // Track who assigned this
        status: 'active'
      };

      const subscription = await Subscription.create(subscriptionData);
      subscriptions.push(subscription);

      // Add to line items for invoice
      line_items.push({
        service_id: service.id,
        service_name: service.name,
        service_name_hi: service.name_hi,
        quantity: 1,
        unit_price: parseFloat(service.price),
        total: parseFloat(service.price)
      });
    }

    console.log('✅ Created subscriptions:', subscriptions.length);

    // Create invoice
    const invoice = await Invoice.create({
      user_id: user_id,
      user_name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
      user_email: user.email,
      family_name: req.body.family_name || null,
      created_by: adminId,
      created_by_name: `${admin.firstName || ''} ${admin.lastName || ''}`.trim(),
      temple_name: req.body.temple_name || null,
      subtotal: subtotal,
      discount_amount: discount_amount,
      coupon_code: coupon_code,
      total_amount: total_amount,
      payment_method: payment_method || 'cash',
      payment_status: 'completed',
      transaction_id: req.body.transaction_id || null,
      line_items: line_items,
      notes: req.body.notes || null
    });

    console.log('✅ Created invoice:', invoice.invoice_number);

    res.status(201).json({
      success: true,
      message: `Successfully assigned ${subscriptions.length} subscription(s)`,
      data: {
        subscriptions: subscriptions.map(s => ({
          id: s.id,
          service_id: s.service_id,
          user_id: s.user_id,
          status: s.status,
          payment_status: s.payment_status
        })),
        invoice: {
          id: invoice.id,
          invoice_number: invoice.invoice_number,
          total_amount: invoice.total_amount,
          created_at: invoice.created_at
        }
      }
    });
  } catch (error) {
    console.error('❌ Admin subscription assignment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign subscriptions'
    });
  }
};

/**
 * @route   GET /api/admin/subscriptions/user/:userId
 * @desc    Get all subscriptions for a user (admin view)
 * @access  Admin only
 */
const getUserSubscriptions = async (req, res) => {
  try {
    const { userId } = req.params;

    const subscriptions = await Subscription.findByUserId(parseInt(userId));

    res.status(200).json({
      success: true,
      data: {
        subscriptions,
        total: subscriptions.length
      }
    });
  } catch (error) {
    console.error('Get user subscriptions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user subscriptions'
    });
  }
};

/**
 * @route   DELETE /api/admin/subscriptions/:subscriptionId
 * @desc    Admin cancels a subscription
 * @access  Admin only
 */
const cancelSubscription = async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const adminId = req.user.id;

    // Update subscription status to cancelled
    const query = `
      UPDATE user_subscriptions
      SET status = 'cancelled',
          cancelled_at = NOW(),
          cancelled_by = $1
      WHERE id = $2
      RETURNING *
    `;

    const result = await pool.query(query, [adminId, subscriptionId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Subscription cancelled successfully',
      data: {
        subscription: result.rows[0]
      }
    });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel subscription'
    });
  }
};

module.exports = {
  assignSubscription,
  getUserSubscriptions,
  cancelSubscription
};
