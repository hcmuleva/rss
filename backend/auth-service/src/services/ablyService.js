/**
 * =====================================================================
 * Ably Service (Backend)
 * Company: emeelan
 * =====================================================================
 */

const Ably = require('ably');
require('dotenv').config();

class AblyService {
  constructor() {
    this.client = null;
    this.initialize();
  }

  initialize() {
    try {
      const apiKey = process.env.ABLY_API_KEY;
      
      if (!apiKey || apiKey === 'YOUR_ABLY_API_KEY_HERE') {
        console.warn('⚠️ Ably API key not configured. Real-time updates disabled.');
        return;
      }

      this.client = new Ably.Realtime({ key: apiKey });

      this.client.connection.on('connected', () => {
        console.log('✅ Ably (backend) connected');
      });

      this.client.connection.on('failed', (error) => {
        console.error('❌ Ably (backend) connection failed:', error);
      });
    } catch (error) {
      console.error('❌ Failed to initialize Ably:', error);
    }
  }

  /**
   * Notify user about role change
   */
  notifyRoleChange(userId, newRole) {
    if (!this.client) {
      console.warn('⚠️ Ably not initialized. Skipping notification.');
      return;
    }

    try {
      const channelName = `user:${userId}:role-updates`;
      const channel = this.client.channels.get(channelName);

      channel.publish('role-changed', {
        userId,
        newRole,
        timestamp: new Date().toISOString(),
      });

      console.log(`✅ Notified user ${userId} about role change to ${newRole}`);
    } catch (error) {
      console.error('❌ Failed to notify role change:', error);
    }
  }

  /**
   * Publish message to user-specific channel
   * @param {number} userId - User ID
   * @param {string} eventType - Event type (e.g., 'temple-assignment', 'notification')
   * @param {object} data - Message data
   */
  async publishToUser(userId, eventType, data) {
    if (!this.client) {
      console.warn('⚠️ Ably not initialized. Skipping notification.');
      return;
    }

    try {
      const channelName = `user-${userId}:${eventType}`;
      const channel = this.client.channels.get(channelName);

      await channel.publish('message', {
        ...data,
        userId,
        timestamp: new Date().toISOString(),
      });

      console.log(`✅ Published to ${channelName}:`, data.type);
    } catch (error) {
      console.error(`❌ Failed to publish to user ${userId}:`, error);
      throw error;
    }
  }

  async publishNotificationToBell(userId, payload) {
    if (!this.client) {
      console.warn('⚠️ Ably not initialized. Skipping notification.');
      return;
    }

    try {
      const channelName = `user-${userId}:notifications`;
      const channel = this.client.channels.get(channelName);

      await channel.publish('announcement-notification', {
        ...payload,
        userId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error(`❌ Failed to publish bell notification to user ${userId}:`, error);
      throw error;
    }
  }

  disconnect() {
    if (this.client) {
      this.client.close();
      console.log('✅ Ably (backend) disconnected');
    }
  }
}

// Export singleton instance
module.exports = new AblyService();
