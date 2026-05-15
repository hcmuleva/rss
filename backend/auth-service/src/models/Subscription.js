/**
 * =====================================================================
 * Subscription Model - User Service Subscriptions
 * Company: emeelan
 * =====================================================================
 */

const pool = require('../config/database');

class Subscription {
  /**
   * Create subscriptions table
   */
  static async createTable() {
    const createQuery = `
      CREATE TABLE IF NOT EXISTS subscriptions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
        status VARCHAR(20) DEFAULT 'active',
        payment_method VARCHAR(50),
        payment_status VARCHAR(20) DEFAULT 'pending',
        amount_paid DECIMAL(10,2) DEFAULT 0,
        discount_amount DECIMAL(10,2) DEFAULT 0,
        coupon_code VARCHAR(50),
        transaction_id VARCHAR(100),
        payment_date TIMESTAMP,
        expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, service_id)
      );

      CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
      CREATE INDEX IF NOT EXISTS idx_subscriptions_service_id ON subscriptions(service_id);
      CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
    `;

    try {
      await pool.query(createQuery);
      console.log('✅ Subscriptions table created/verified');

      // Add new columns if they don't exist (migration)
      await this.migrateTable();
      
      console.log('✅ Subscriptions table ready');
    } catch (error) {
      console.error('❌ Error creating subscriptions table:', error);
      throw error;
    }
  }

  /**
   * Migrate existing table to add new columns
   */
  static async migrateTable() {
    try {
      // Check if subscribed_by column exists
      const checkQuery = `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name='subscriptions' AND column_name='subscribed_by'
      `;
      const result = await pool.query(checkQuery);

      if (result.rows.length === 0) {
        // Add new columns
        console.log('🔄 Migrating subscriptions table - adding new columns...');
        
        const migrateQuery = `
          ALTER TABLE subscriptions 
          ADD COLUMN IF NOT EXISTS subscribed_by INTEGER REFERENCES users(id),
          ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP,
          ADD COLUMN IF NOT EXISTS cancelled_by INTEGER REFERENCES users(id);

          CREATE INDEX IF NOT EXISTS idx_subscriptions_subscribed_by ON subscriptions(subscribed_by);
        `;
        
        await pool.query(migrateQuery);
        console.log('✅ Migration complete - new columns added');
      }
    } catch (error) {
      console.error('⚠️ Migration warning:', error.message);
      // Don't throw - let the app continue if migration fails
    }
  }

  /**
   * Create subscription
   */
  static async create(data) {
    const {
      user_id,
      service_id,
      payment_method,
      amount_paid,
      discount_amount = 0,
      coupon_code = null,
      transaction_id = null,
      payment_status = 'pending',
      subscribed_by = null
    } = data;

    const query = `
      INSERT INTO subscriptions (
        user_id, service_id, payment_method, payment_status,
        amount_paid, discount_amount, coupon_code, transaction_id,
        payment_date, status, subscribed_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, 'active', $9)
      ON CONFLICT (user_id, service_id) 
      DO UPDATE SET 
        payment_method = EXCLUDED.payment_method,
        payment_status = EXCLUDED.payment_status,
        amount_paid = EXCLUDED.amount_paid,
        discount_amount = EXCLUDED.discount_amount,
        coupon_code = EXCLUDED.coupon_code,
        transaction_id = EXCLUDED.transaction_id,
        payment_date = EXCLUDED.payment_date,
        status = 'active',
        subscribed_by = EXCLUDED.subscribed_by,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const result = await pool.query(query, [
      user_id,
      service_id,
      payment_method,
      payment_status,
      amount_paid,
      discount_amount,
      coupon_code,
      transaction_id,
      subscribed_by
    ]);

    return result.rows[0];
  }

  /**
   * Get user subscriptions with service details
   */
  static async findByUserId(userId) {
    const query = `
      SELECT 
        s.*,
        srv.slug as service_slug,
        srv.name as service_name,
        srv.name_hi as service_name_hi,
        srv.icon as service_icon,
        srv.color as service_color,
        srv.category as service_category
      FROM subscriptions s
      INNER JOIN services srv ON s.service_id = srv.id
      WHERE s.user_id = $1 AND s.status = 'active'
      ORDER BY s.created_at DESC
    `;

    const result = await pool.query(query, [userId]);
    return result.rows;
  }

  /**
   * Check if user has subscription to service
   */
  static async hasSubscription(userId, serviceId) {
    const query = `
      SELECT id FROM subscriptions 
      WHERE user_id = $1 AND service_id = $2 AND status = 'active'
    `;

    const result = await pool.query(query, [userId, serviceId]);
    return result.rows.length > 0;
  }

  /**
   * Cancel user's active subscription by subscription ID
   */
  static async cancelByIdForUser(subscriptionId, userId) {
    const query = `
      UPDATE subscriptions
      SET 
        status = 'cancelled',
        cancelled_at = CURRENT_TIMESTAMP,
        cancelled_by = $2,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
        AND user_id = $2
        AND status = 'active'
      RETURNING *
    `;

    const result = await pool.query(query, [subscriptionId, userId]);
    return result.rows[0] || null;
  }

  /**
   * Cancel user's active subscription by service ID
   */
  static async cancelByServiceForUser(serviceId, userId) {
    const query = `
      UPDATE subscriptions
      SET 
        status = 'cancelled',
        cancelled_at = CURRENT_TIMESTAMP,
        cancelled_by = $2,
        updated_at = CURRENT_TIMESTAMP
      WHERE service_id = $1
        AND user_id = $2
        AND status = 'active'
      RETURNING *
    `;

    const result = await pool.query(query, [serviceId, userId]);
    return result.rows[0] || null;
  }

  /**
   * Get all subscriptions for admin
   */
  static async findAll() {
    const query = `
      SELECT 
        s.*,
        u.first_name, u.email,
        srv.name as service_name
      FROM subscriptions s
      INNER JOIN users u ON s.user_id = u.id
      INNER JOIN services srv ON s.service_id = srv.id
      ORDER BY s.created_at DESC
    `;

    const result = await pool.query(query);
    return result.rows;
  }
}

module.exports = Subscription;
