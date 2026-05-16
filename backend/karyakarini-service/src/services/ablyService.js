const Ably = require('ably');

class KaryakariniAblyService {
  constructor() {
    this.client = null;
    this.enabled = false;
    this.initialize();
  }

  initialize() {
    const apiKey = String(process.env.ABLY_API_KEY || '').trim();
    if (!apiKey) {
      this.enabled = false;
      return;
    }

    try {
      this.client = new Ably.Realtime({ key: apiKey });
      this.enabled = true;
      this.client.connection.on('failed', (error) => {
        console.error('Karyakarini Ably connection failed:', error?.message || error);
      });
    } catch (error) {
      this.enabled = false;
      this.client = null;
      console.error('Failed to initialize Karyakarini Ably:', error?.message || error);
    }
  }

  async publishNotification(userId, payload) {
    const safeUserId = Number(userId);
    if (!this.enabled || !this.client || !Number.isFinite(safeUserId) || safeUserId <= 0) return;
    try {
      const channel = this.client.channels.get(`user-${safeUserId}:notifications`);
      await channel.publish('karyakarini-notification', {
        category: 'karyakarini',
        ...payload,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to publish karyakarini notification:', error?.message || error);
    }
  }

  close() {
    if (this.client) this.client.close();
    this.client = null;
    this.enabled = false;
  }
}

module.exports = new KaryakariniAblyService();
