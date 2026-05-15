/**
 * =====================================================================
 * Coupon Model - Discount Coupons
 * Company: emeelan
 * =====================================================================
 */

const pool = require('../config/database');

class Coupon {
  /**
   * Create coupons table
   */
  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS coupons (
        id SERIAL PRIMARY KEY,
        code VARCHAR(50) UNIQUE NOT NULL,
        description TEXT,
        discount_type VARCHAR(20) NOT NULL,
        discount_value DECIMAL(10,2) NOT NULL,
        min_amount DECIMAL(10,2) DEFAULT 0,
        max_discount DECIMAL(10,2),
        start_date TIMESTAMP NOT NULL,
        end_date TIMESTAMP NOT NULL,
        usage_limit INTEGER DEFAULT NULL,
        usage_count INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
      CREATE INDEX IF NOT EXISTS idx_coupons_is_active ON coupons(is_active);
    `;

    try {
      await pool.query(query);
      console.log('✅ Coupons table ready');
      
      // Seed default coupons
      await this.seedCoupons();
    } catch (error) {
      console.error('❌ Error creating coupons table:', error);
      throw error;
    }
  }

  /**
   * Seed default coupons
   */
  static async seedCoupons() {
    try {
      const checkQuery = 'SELECT COUNT(*) as count FROM coupons';
      const result = await pool.query(checkQuery);
      
      if (parseInt(result.rows[0].count) > 0) {
        console.log('✅ Coupons already seeded');
        return;
      }

      const coupons = [
        {
          code: 'WELCOME50',
          description: 'Welcome offer - 50% off on first subscription',
          discount_type: 'percentage',
          discount_value: 50,
          min_amount: 0,
          max_discount: 250,
          start_date: '2026-01-01',
          end_date: '2026-12-31',
          usage_limit: null,
          is_active: true
        },
        {
          code: 'DIWALI30',
          description: 'Diwali Special - 30% off',
          discount_type: 'percentage',
          discount_value: 30,
          min_amount: 100,
          max_discount: 150,
          start_date: '2026-10-20',
          end_date: '2026-11-05',
          usage_limit: 1000,
          is_active: true
        },
        {
          code: 'FLAT100',
          description: 'Flat ₹100 off on all services',
          discount_type: 'fixed',
          discount_value: 100,
          min_amount: 199,
          max_discount: 100,
          start_date: '2026-01-01',
          end_date: '2026-12-31',
          usage_limit: null,
          is_active: true
        }
      ];

      for (const coupon of coupons) {
        await pool.query(`
          INSERT INTO coupons (code, description, discount_type, discount_value, min_amount, max_discount, start_date, end_date, usage_limit, is_active)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [coupon.code, coupon.description, coupon.discount_type, coupon.discount_value, coupon.min_amount, coupon.max_discount, coupon.start_date, coupon.end_date, coupon.usage_limit, coupon.is_active]);
      }

      console.log(`✅ Seeded ${coupons.length} coupons`);
    } catch (error) {
      console.log('⚠️ Could not seed coupons:', error.message);
    }
  }

  /**
   * Validate and get coupon
   */
  static async validate(code, amount) {
    const query = `
      SELECT * FROM coupons 
      WHERE code = $1 
        AND is_active = true 
        AND start_date <= CURRENT_TIMESTAMP 
        AND end_date >= CURRENT_TIMESTAMP
        AND (usage_limit IS NULL OR usage_count < usage_limit)
    `;

    const result = await pool.query(query, [code.toUpperCase()]);
    
    if (result.rows.length === 0) {
      throw new Error('Invalid or expired coupon code');
    }

    const coupon = result.rows[0];

    // Check minimum amount
    if (amount < coupon.min_amount) {
      throw new Error(`Minimum amount ₹${coupon.min_amount} required for this coupon`);
    }

    return coupon;
  }

  /**
   * Calculate discount
   */
  static calculateDiscount(coupon, amount) {
    let discount = 0;

    if (coupon.discount_type === 'percentage') {
      discount = (amount * coupon.discount_value) / 100;
      if (coupon.max_discount) {
        discount = Math.min(discount, coupon.max_discount);
      }
    } else {
      discount = coupon.discount_value;
    }

    return Math.round(discount * 100) / 100; // Round to 2 decimals
  }

  /**
   * Increment usage count
   */
  static async incrementUsage(code) {
    const query = `
      UPDATE coupons 
      SET usage_count = usage_count + 1, updated_at = CURRENT_TIMESTAMP
      WHERE code = $1
      RETURNING *
    `;

    const result = await pool.query(query, [code.toUpperCase()]);
    return result.rows[0];
  }

  /**
   * Get all coupons (admin)
   */
  static async findAll() {
    const query = 'SELECT * FROM coupons ORDER BY created_at DESC';
    const result = await pool.query(query);
    return result.rows;
  }
}

module.exports = Coupon;
