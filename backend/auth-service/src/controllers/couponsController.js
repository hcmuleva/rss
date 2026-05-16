/**
 * =====================================================================
 * Coupons Controller
 * Company: emeelan
 * =====================================================================
 */

const Coupon = require('../models/Coupon');

/**
 * @route   POST /api/coupons/validate
 * @desc    Validate coupon code
 * @access  Public
 */
const validateCoupon = async (req, res) => {
  try {
    const { code, amount } = req.body;

    // Validate input
    if (!code || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Coupon code and amount are required'
      });
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid amount'
      });
    }

    // Validate coupon
    const coupon = await Coupon.validate(code, parsedAmount);
    const discount_amount = Coupon.calculateDiscount(coupon, parsedAmount);
    const final_amount = parsedAmount - discount_amount;

    res.status(200).json({
      success: true,
      message: 'Coupon is valid',
      data: {
        coupon: {
          code: coupon.code,
          description: coupon.description,
          discount_type: coupon.discount_type,
          discount_value: coupon.discount_value
        },
        original_amount: parsedAmount,
        discount_amount,
        final_amount,
        savings: discount_amount
      }
    });
  } catch (error) {
    console.error('Validate coupon error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Invalid coupon code'
    });
  }
};

/**
 * @route   GET /api/coupons
 * @desc    Get all coupons (admin only)
 * @access  Admin
 */
const getAllCoupons = async (req, res) => {
  try {
    const coupons = await Coupon.findAll();

    res.status(200).json({
      success: true,
      data: {
        coupons,
        total: coupons.length
      }
    });
  } catch (error) {
    console.error('Get coupons error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get coupons'
    });
  }
};

module.exports = {
  validateCoupon,
  getAllCoupons
};
