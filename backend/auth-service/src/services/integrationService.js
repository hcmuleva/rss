/**
 * =====================================================================
 * Integration Service - External Service Integration
 * Service: Auth Service
 * Company: emeelan
 * =====================================================================
 */

const axios = require('axios');

class IntegrationService {
  /**
   * Get user's active membership
   */
  static async getUserMembership(userId, authToken) {
    try {
      const response = await axios.get(
        `${process.env.MEMBERSHIP_SERVICE_URL || 'http://localhost:4006'}/api/memberships/my`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      if (response.data.success && response.data.data.has_membership) {
        return response.data.data.membership;
      }

      return null;
    } catch (error) {
      console.error('Error fetching membership:', error.message);
      return null;
    }
  }

  /**
   * Calculate membership discount
   */
  static async calculateMembershipDiscount(userId, amount, authToken) {
    try {
      const membership = await this.getUserMembership(userId, authToken);

      if (!membership) {
        return 0;
      }

      // Get discount percentage from membership benefits
      const discountPercentage = membership.benefits?.discount_percentage || 0;
      
      // Calculate discount
      const discount = (amount * discountPercentage) / 100;

      return Math.round(discount * 100) / 100;
    } catch (error) {
      console.error('Error calculating membership discount:', error.message);
      return 0;
    }
  }

  /**
   * Credit points to user via rewards service
   */
  static async creditPoints(data, authToken) {
    try {
      const response = await axios.post(
        `${process.env.REWARDS_SERVICE_URL || 'http://localhost:4007'}/api/points/credit`,
        data,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.success) {
        return response.data.data;
      }

      return null;
    } catch (error) {
      console.error('Error crediting points:', error.message);
      return null;
    }
  }

  /**
   * Calculate points for subscription
   */
  static async calculateSubscriptionPoints(subscriptionData, authToken) {
    try {
      const response = await axios.post(
        `${process.env.REWARDS_SERVICE_URL || 'http://localhost:4007'}/api/points/calculate`,
        {
          action_type: 'subscription',
          action_data: subscriptionData
        },
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.success) {
        return response.data.data.points_to_earn;
      }

      return 0;
    } catch (error) {
      console.error('Error calculating subscription points:', error.message);
      return 0;
    }
  }

  /**
   * Calculate redemption value
   */
  static async calculateRedemption(points, amount, redemptionType, authToken) {
    try {
      const response = await axios.post(
        `${process.env.REWARDS_SERVICE_URL || 'http://localhost:4007'}/api/points/calculate-redemption`,
        {
          points,
          amount,
          redemption_type: redemptionType
        },
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.success) {
        return response.data.data;
      }

      return null;
    } catch (error) {
      console.error('Error calculating redemption:', error.message);
      return null;
    }
  }

  /**
   * Redeem points
   */
  static async redeemPoints(data, authToken) {
    try {
      const response = await axios.post(
        `${process.env.REWARDS_SERVICE_URL || 'http://localhost:4007'}/api/points/redeem`,
        data,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.success) {
        return response.data.data;
      }

      return null;
    } catch (error) {
      console.error('Error redeeming points:', error.message);
      throw error;
    }
  }

  /**
   * Get user's points wallet
   */
  static async getUserWallet(authToken) {
    try {
      const response = await axios.get(
        `${process.env.REWARDS_SERVICE_URL || 'http://localhost:4007'}/api/points/wallet`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      if (response.data.success) {
        return response.data.data.wallet;
      }

      return null;
    } catch (error) {
      console.error('Error fetching wallet:', error.message);
      return null;
    }
  }
}

module.exports = IntegrationService;
