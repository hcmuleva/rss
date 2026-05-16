/**
 * =====================================================================
 * Enhanced Subscriptions Controller
 * Company: emeelan
 * =====================================================================
 * Integrates with Membership Service (discounts) and Rewards Service (points)
 */

const Subscription = require('../models/Subscription');
const Service = require('../models/Service');
const Coupon = require('../models/Coupon');
const IntegrationService = require('../services/integrationService');

/**
 * @route   POST /api/subscriptions/enhanced
 * @desc    Create subscription with membership discounts and points
 * @access  Private
 */
const createEnhancedSubscription = async (req, res) => {
  try {
    const { 
      service_id, 
      payment_method, 
      coupon_code,
      points_to_redeem = 0
    } = req.body;
    const userId = req.user.id;
    const authToken = req.headers.authorization?.split(' ')[1];

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

    let basePrice = parseFloat(service.price);
    let discountBreakdown = {
      membership_discount: 0,
      coupon_discount: 0,
      points_discount: 0
    };

    // 1. Apply membership discount (if user has membership)
    const membershipDiscount = await IntegrationService.calculateMembershipDiscount(
      userId,
      basePrice,
      authToken
    );
    
    if (membershipDiscount > 0) {
      discountBreakdown.membership_discount = membershipDiscount;
      basePrice -= membershipDiscount;
    }

    // 2. Apply coupon discount (stackable with membership)
    let validatedCouponCode = null;
    if (coupon_code && basePrice > 0) {
      try {
        const coupon = await Coupon.validate(coupon_code, basePrice);
        const couponDiscount = Coupon.calculateDiscount(coupon, basePrice);
        discountBreakdown.coupon_discount = couponDiscount;
        basePrice -= couponDiscount;
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

    // 3. Apply points redemption (NOT stackable with coupon)
    let pointsDiscount = 0;
    let pointsRedeemed = 0;

    if (points_to_redeem > 0 && discountBreakdown.coupon_discount === 0) {
      try {
        const redemptionData = await IntegrationService.calculateRedemption(
          points_to_redeem,
          basePrice,
          'subscription_discount',
          authToken
        );

        if (redemptionData && redemptionData.can_redeem) {
          // Redeem points
          const redeemResult = await IntegrationService.redeemPoints({
            points: points_to_redeem,
            redemption_type: 'subscription_discount',
            amount: basePrice,
            service_id: service_id,
            transaction_id: null // Will be updated after subscription created
          }, authToken);

          if (redeemResult) {
            pointsDiscount = redeemResult.value_redeemed;
            pointsRedeemed = redeemResult.points_redeemed;
            discountBreakdown.points_discount = pointsDiscount;
            basePrice -= pointsDiscount;
          }
        } else {
          return res.status(400).json({
            success: false,
            message: redemptionData?.message || 'Cannot redeem points for this transaction'
          });
        }
      } catch (pointsError) {
        return res.status(400).json({
          success: false,
          message: `Points redemption failed: ${pointsError.message}`
        });
      }
    } else if (points_to_redeem > 0 && discountBreakdown.coupon_discount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot use both coupon and points. Please choose one.'
      });
    }

    const finalAmount = Math.max(0, basePrice);
    const totalDiscount = Object.values(discountBreakdown).reduce((a, b) => a + b, 0);

    // Create subscription
    const subscription = await Subscription.create({
      user_id: userId,
      service_id,
      payment_method,
      amount_paid: finalAmount,
      discount_amount: totalDiscount,
      coupon_code: validatedCouponCode,
      payment_status: payment_method === 'cash' ? 'pending' : 'completed'
    });

    // 4. Award points for subscription (if not using points for payment)
    let pointsEarned = 0;
    if (pointsRedeemed === 0) {
      try {
        const creditResult = await IntegrationService.creditPoints({
          user_id: userId,
          points: 0, // Will be calculated by rewards service
          source: 'subscription',
          reference_id: subscription.id.toString(),
          notes: `Subscription to ${service.name}`
        }, authToken);

        if (creditResult) {
          // Calculate points based on original price (not discounted)
          const pointsData = await IntegrationService.calculateSubscriptionPoints({
            amount_paid: parseFloat(service.price) // Use original price for points calculation
          }, authToken);
          
          pointsEarned = pointsData || 0;
        }
      } catch (error) {
        console.error('Failed to award points:', error.message);
        // Don't fail the subscription if points fail
      }
    }

    res.status(201).json({
      success: true,
      message: 'Subscription created successfully',
      data: {
        subscription: {
          id: subscription.id,
          service_id: subscription.service_id,
          service_name: service.name,
          status: subscription.status,
          payment_status: subscription.payment_status,
          created_at: subscription.created_at
        },
        pricing: {
          original_price: parseFloat(service.price),
          membership_discount: discountBreakdown.membership_discount,
          coupon_discount: discountBreakdown.coupon_discount,
          points_discount: discountBreakdown.points_discount,
          total_discount: totalDiscount,
          final_amount: finalAmount,
          savings: parseFloat(service.price) - finalAmount
        },
        rewards: {
          points_redeemed: pointsRedeemed,
          points_earned: pointsEarned,
          net_points_change: pointsEarned - pointsRedeemed
        }
      }
    });
  } catch (error) {
    console.error('Create enhanced subscription error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create subscription'
    });
  }
};

/**
 * @route   POST /api/subscriptions/batch-enhanced
 * @desc    Create multiple subscriptions with discounts and points
 * @access  Private
 */
const createBatchEnhancedSubscriptions = async (req, res) => {
  try {
    const { 
      service_ids, 
      payment_method, 
      coupon_code,
      points_to_redeem = 0
    } = req.body;
    const userId = req.user.id;
    const authToken = req.headers.authorization?.split(' ')[1];

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
    let subtotal = 0;

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
        subtotal += parseFloat(service.price);
      }
    }

    if (services.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Already subscribed to all selected services'
      });
    }

    let currentTotal = subtotal;
    let discountBreakdown = {
      membership_discount: 0,
      coupon_discount: 0,
      points_discount: 0
    };

    // 1. Apply membership discount
    const membershipDiscount = await IntegrationService.calculateMembershipDiscount(
      userId,
      currentTotal,
      authToken
    );
    
    if (membershipDiscount > 0) {
      discountBreakdown.membership_discount = membershipDiscount;
      currentTotal -= membershipDiscount;
    }

    // 2. Apply coupon
    let validatedCouponCode = null;
    if (coupon_code && currentTotal > 0) {
      try {
        const coupon = await Coupon.validate(coupon_code, currentTotal);
        const couponDiscount = Coupon.calculateDiscount(coupon, currentTotal);
        discountBreakdown.coupon_discount = couponDiscount;
        currentTotal -= couponDiscount;
        validatedCouponCode = coupon.code;
        await Coupon.incrementUsage(coupon.code);
      } catch (couponError) {
        return res.status(400).json({
          success: false,
          message: couponError.message
        });
      }
    }

    // 3. Apply points
    let pointsRedeemed = 0;
    if (points_to_redeem > 0 && discountBreakdown.coupon_discount === 0) {
      try {
        const redeemResult = await IntegrationService.redeemPoints({
          points: points_to_redeem,
          redemption_type: 'subscription_discount',
          amount: currentTotal,
          transaction_id: null
        }, authToken);

        if (redeemResult) {
          discountBreakdown.points_discount = redeemResult.value_redeemed;
          pointsRedeemed = redeemResult.points_redeemed;
          currentTotal -= redeemResult.value_redeemed;
        }
      } catch (error) {
        // Ignore points error, continue with subscription
        console.error('Points redemption failed:', error.message);
      }
    }

    const finalAmount = Math.max(0, currentTotal);
    const totalDiscount = Object.values(discountBreakdown).reduce((a, b) => a + b, 0);
    const amountPerService = services.length > 0 ? finalAmount / services.length : 0;

    // Create subscriptions
    const subscriptions = [];
    for (const service of services) {
      const subscription = await Subscription.create({
        user_id: userId,
        service_id: service.id,
        payment_method,
        amount_paid: amountPerService,
        discount_amount: totalDiscount / services.length,
        coupon_code: validatedCouponCode,
        payment_status: payment_method === 'cash' ? 'pending' : 'completed'
      });
      
      subscriptions.push({
        id: subscription.id,
        service_id: service.id,
        service_name: service.name,
        status: subscription.status
      });

      // Award points for each service
      if (pointsRedeemed === 0) {
        try {
          await IntegrationService.creditPoints({
            user_id: userId,
            points: Math.round((parseFloat(service.price) * 0.10)), // 10% as points
            source: 'subscription',
            reference_id: subscription.id.toString(),
            notes: `Batch subscription to ${service.name}`
          }, authToken);
        } catch (error) {
          console.error('Failed to award points for service:', service.name);
        }
      }
    }

    res.status(201).json({
      success: true,
      message: `Successfully subscribed to ${subscriptions.length} service(s)`,
      data: {
        subscriptions,
        total_services: subscriptions.length,
        pricing: {
          subtotal,
          membership_discount: discountBreakdown.membership_discount,
          coupon_discount: discountBreakdown.coupon_discount,
          points_discount: discountBreakdown.points_discount,
          total_discount: totalDiscount,
          final_amount: finalAmount,
          total_savings: subtotal - finalAmount
        },
        rewards: {
          points_redeemed: pointsRedeemed,
          points_earned: pointsRedeemed === 0 ? Math.round(subtotal * 0.10) : 0
        }
      }
    });
  } catch (error) {
    console.error('Create batch enhanced subscriptions error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create subscriptions'
    });
  }
};

/**
 * @route   GET /api/subscriptions/my-enhanced
 * @desc    Get user's subscriptions with points wallet info
 * @access  Private
 */
const getMyEnhancedSubscriptions = async (req, res) => {
  try {
    const authToken = req.headers.authorization?.split(' ')[1];
    
    // Get subscriptions
    const subscriptions = await Subscription.findByUserId(req.user.id);

    // Get points wallet
    const wallet = await IntegrationService.getUserWallet(authToken);

    // Get membership
    const membership = await IntegrationService.getUserMembership(req.user.id, authToken);

    res.status(200).json({
      success: true,
      data: {
        subscriptions,
        total_subscriptions: subscriptions.length,
        membership: membership || { has_membership: false },
        points: wallet || { current_balance: 0 }
      }
    });
  } catch (error) {
    console.error('Get enhanced subscriptions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get subscriptions'
    });
  }
};

module.exports = {
  createEnhancedSubscription,
  createBatchEnhancedSubscriptions,
  getMyEnhancedSubscriptions
};
