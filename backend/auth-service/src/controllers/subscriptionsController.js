/**
 * =====================================================================
 * Subscriptions Controller
 * Company: emeelan
 * =====================================================================
 */

const Subscription = require('../models/Subscription');
const Service = require('../models/Service');
const Coupon = require('../models/Coupon');

/**
 * @route   POST /api/subscriptions
 * @desc    Create subscription (subscribe to service)
 * @access  Private
 */
const createSubscription = async (req, res) => {
  try {
    const { service_id, payment_method, coupon_code } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!service_id || !payment_method) {
      return res.status(400).json({
        success: false,
        message: 'Service ID and payment method are required'
      });
    }

    // Get service details
    const service = await Service.findById(service_id);
    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    // Check if already subscribed
    const hasSubscription = await Subscription.hasSubscription(userId, service_id);
    if (hasSubscription) {
      return res.status(400).json({
        success: false,
        message: 'Already subscribed to this service'
      });
    }

    let amount_paid = parseFloat(service.price);
    let discount_amount = 0;
    let validatedCouponCode = null;

    // Apply coupon if provided
    if (coupon_code && amount_paid > 0) {
      try {
        const coupon = await Coupon.validate(coupon_code, amount_paid);
        discount_amount = Coupon.calculateDiscount(coupon, amount_paid);
        validatedCouponCode = coupon.code;
        
        // Increment coupon usage
        await Coupon.incrementUsage(coupon.code);
      } catch (couponError) {
        return res.status(400).json({
          success: false,
          message: couponError.message
        });
      }
    }

    const final_amount = amount_paid - discount_amount;

    // Create subscription
    const subscription = await Subscription.create({
      user_id: userId,
      service_id,
      payment_method,
      amount_paid: final_amount,
      discount_amount,
      coupon_code: validatedCouponCode,
      payment_status: payment_method === 'cash' ? 'pending' : 'completed'
    });

    res.status(201).json({
      success: true,
      message: 'Subscription created successfully',
      data: {
        subscription,
        service_name: service.name,
        original_amount: amount_paid,
        discount_amount,
        final_amount,
        payment_status: subscription.payment_status
      }
    });
  } catch (error) {
    console.error('Create subscription error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create subscription'
    });
  }
};

/**
 * @route   POST /api/subscriptions/batch
 * @desc    Create multiple subscriptions at once (cart checkout)
 * @access  Private
 */
const createBatchSubscriptions = async (req, res) => {
  try {
    const { service_ids, payment_method, coupon_code } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!service_ids || !Array.isArray(service_ids) || service_ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Service IDs array is required'
      });
    }

    if (!payment_method) {
      return res.status(400).json({
        success: false,
        message: 'Payment method is required'
      });
    }

    // Get all services
    const services = [];
    let total_amount = 0;

    for (const service_id of service_ids) {
      const service = await Service.findById(service_id);
      if (!service) {
        return res.status(404).json({
          success: false,
          message: `Service with ID ${service_id} not found`
        });
      }

      // Check if already subscribed
      const hasSubscription = await Subscription.hasSubscription(userId, service_id);
      if (!hasSubscription) {
        services.push(service);
        total_amount += parseFloat(service.price);
      }
    }

    if (services.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Already subscribed to all selected services'
      });
    }

    let discount_amount = 0;
    let validatedCouponCode = null;

    // Apply coupon if provided
    if (coupon_code && total_amount > 0) {
      try {
        const coupon = await Coupon.validate(coupon_code, total_amount);
        discount_amount = Coupon.calculateDiscount(coupon, total_amount);
        validatedCouponCode = coupon.code;
        
        // Increment coupon usage
        await Coupon.incrementUsage(coupon.code);
      } catch (couponError) {
        return res.status(400).json({
          success: false,
          message: couponError.message
        });
      }
    }

    const final_amount = total_amount - discount_amount;
    const amount_per_service = services.length > 0 ? final_amount / services.length : 0;

    // Create subscriptions for all services
    const subscriptions = [];
    for (const service of services) {
      const subscription = await Subscription.create({
        user_id: userId,
        service_id: service.id,
        payment_method,
        amount_paid: amount_per_service,
        discount_amount: discount_amount / services.length,
        coupon_code: validatedCouponCode,
        payment_status: payment_method === 'cash' ? 'pending' : 'completed'
      });
      subscriptions.push({
        ...subscription,
        service_name: service.name
      });
    }

    res.status(201).json({
      success: true,
      message: `Successfully subscribed to ${subscriptions.length} service(s)`,
      data: {
        subscriptions,
        total_services: subscriptions.length,
        original_amount: total_amount,
        discount_amount,
        final_amount,
        payment_status: subscriptions[0].payment_status
      }
    });
  } catch (error) {
    console.error('Create batch subscriptions error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create subscriptions'
    });
  }
};

/**
 * @route   GET /api/subscriptions/my
 * @desc    Get user's subscriptions
 * @access  Private
 */
const getMySubscriptions = async (req, res) => {
  try {
    const subscriptions = await Subscription.findByUserId(req.user.id);

    // Format subscriptions to include service object for mobile app
    const formattedSubscriptions = subscriptions.map(sub => ({
      id: sub.id,
      service_id: sub.service_id,
      service_slug: sub.service_slug,
      service_name: sub.service_name,
      service_name_hi: sub.service_name_hi,
      service_icon: sub.service_icon,
      service_color: sub.service_color,
      payment_method: sub.payment_method,
      payment_status: sub.payment_status,
      amount_paid: sub.amount_paid,
      discount_amount: sub.discount_amount,
      coupon_code: sub.coupon_code,
      created_at: sub.created_at,
      service: {
        id: sub.service_id,
        slug: sub.service_slug,
        name: sub.service_name,
        name_hi: sub.service_name_hi,
        icon: sub.service_icon,
        color: sub.service_color,
        category: sub.service_category,
      },
      status: sub.status,
      started_at: sub.created_at,
      expires_at: sub.expires_at,
    }));
    
    // Virtual default services (available for everyone)
    const DEFAULT_SERVICES = [
      { slug: 'family-tree', name: 'Family Tree', name_hi: 'वंश वृक्ष', icon: '🌳', color: '#e8f5e9' },
      { slug: 'temple', name: 'Temple Management', name_hi: 'मंदिर प्रबंधन', icon: '🛕', color: '#fff3e0' }
    ];

    for (const defSvc of DEFAULT_SERVICES) {
      if (!formattedSubscriptions.some(s => s.service_slug === defSvc.slug)) {
        formattedSubscriptions.push({
          id: -1, // Virtual ID
          service_id: defSvc.slug === 'family-tree' ? 1 : 2,
          service_slug: defSvc.slug,
          service_name: defSvc.name,
          service_name_hi: defSvc.name_hi,
          service_icon: defSvc.icon,
          service_color: defSvc.color,
          status: 'active',
          payment_status: 'completed',
          service: {
            id: defSvc.slug === 'family-tree' ? 1 : 2,
            slug: defSvc.slug,
            name: defSvc.name,
            name_hi: defSvc.name_hi,
            icon: defSvc.icon,
            color: defSvc.color,
            category: 'free',
            is_free: true
          }
        });
      }
    }

    res.status(200).json({
      success: true,
      data: {
        subscriptions: formattedSubscriptions,
        total: formattedSubscriptions.length
      }
    });
  } catch (error) {
    console.error('Get subscriptions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get subscriptions'
    });
  }
};

/**
 * @route   DELETE /api/subscriptions/:subscriptionId
 * @desc    Cancel my active subscription
 * @access  Private
 */
const cancelMySubscription = async (req, res) => {
  try {
    const userId = req.user.id;
    const subscriptionId = parseInt(req.params.subscriptionId, 10);

    if (!Number.isInteger(subscriptionId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid subscription id'
      });
    }

    const cancelled = await Subscription.cancelByIdForUser(subscriptionId, userId);
    if (!cancelled) {
      return res.status(404).json({
        success: false,
        message: 'Active subscription not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Subscription cancelled successfully',
      data: { subscription: cancelled }
    });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to cancel subscription'
    });
  }
};

/**
 * @route   DELETE /api/subscriptions/service/:serviceId
 * @desc    Cancel my active subscription by service id
 * @access  Private
 */
const cancelMySubscriptionByService = async (req, res) => {
  try {
    const userId = req.user.id;
    const serviceId = parseInt(req.params.serviceId, 10);

    if (!Number.isInteger(serviceId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid service id'
      });
    }

    const cancelled = await Subscription.cancelByServiceForUser(serviceId, userId);
    if (!cancelled) {
      return res.status(404).json({
        success: false,
        message: 'Active subscription not found for this service'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Subscription cancelled successfully',
      data: { subscription: cancelled }
    });
  } catch (error) {
    console.error('Cancel subscription by service error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to cancel subscription'
    });
  }
};

/**
 * @route   GET /api/subscriptions
 * @desc    Get all subscriptions (admin only)
 * @access  Admin
 */
const getAllSubscriptions = async (req, res) => {
  try {
    const subscriptions = await Subscription.findAll();

    res.status(200).json({
      success: true,
      data: {
        subscriptions,
        total: subscriptions.length
      }
    });
  } catch (error) {
    console.error('Get all subscriptions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get subscriptions'
    });
  }
};

module.exports = {
  createSubscription,
  createBatchSubscriptions,
  getMySubscriptions,
  getAllSubscriptions,
  cancelMySubscription,
  cancelMySubscriptionByService
};
