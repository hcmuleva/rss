/**
 * =====================================================================
 * Invoice Model
 * Company: emeelan
 * =====================================================================
 * Manages invoices for subscription payments
 */

const pool = require('../config/database');

class Invoice {
  /**
   * Create invoices table
   */
  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS invoices (
        id SERIAL PRIMARY KEY,
        invoice_number VARCHAR(50) UNIQUE NOT NULL,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        user_name VARCHAR(255),
        user_email VARCHAR(255),
        family_name VARCHAR(255),
        created_by INTEGER REFERENCES users(id),
        created_by_name VARCHAR(255),
        temple_name VARCHAR(255),
        subtotal DECIMAL(10,2) NOT NULL,
        discount_amount DECIMAL(10,2) DEFAULT 0,
        coupon_code VARCHAR(50),
        total_amount DECIMAL(10,2) NOT NULL,
        payment_method VARCHAR(50) NOT NULL,
        payment_status VARCHAR(20) DEFAULT 'completed',
        transaction_id VARCHAR(100),
        line_items JSONB NOT NULL,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);
      CREATE INDEX IF NOT EXISTS idx_invoices_created_by ON invoices(created_by);
      CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON invoices(invoice_number);
      CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at);
    `;

    try {
      await pool.query(query);
      console.log('✅ Invoices table ready');
    } catch (error) {
      console.error('❌ Error creating invoices table:', error);
      throw error;
    }
  }

  /**
   * Generate unique invoice number
   */
  static generateInvoiceNumber() {
    const year = new Date().getFullYear();
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `INV-${year}-${timestamp}${random}`;
  }

  /**
   * Create invoice
   */
  static async create(data) {
    const {
      user_id,
      user_name,
      user_email,
      family_name,
      created_by,
      created_by_name,
      temple_name,
      subtotal,
      discount_amount = 0,
      coupon_code = null,
      total_amount,
      payment_method,
      payment_status = 'completed',
      transaction_id = null,
      line_items,
      notes = null
    } = data;

    const invoice_number = this.generateInvoiceNumber();

    const query = `
      INSERT INTO invoices (
        invoice_number, user_id, user_name, user_email, family_name,
        created_by, created_by_name, temple_name,
        subtotal, discount_amount, coupon_code, total_amount,
        payment_method, payment_status, transaction_id,
        line_items, notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *
    `;

    const result = await pool.query(query, [
      invoice_number, user_id, user_name, user_email, family_name,
      created_by, created_by_name, temple_name,
      subtotal, discount_amount, coupon_code, total_amount,
      payment_method, payment_status, transaction_id,
      JSON.stringify(line_items), notes
    ]);

    return result.rows[0];
  }

  /**
   * Get invoice by ID
   */
  static async findById(id) {
    const query = 'SELECT * FROM invoices WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  /**
   * Get invoice by invoice number
   */
  static async findByInvoiceNumber(invoice_number) {
    const query = 'SELECT * FROM invoices WHERE invoice_number = $1';
    const result = await pool.query(query, [invoice_number]);
    return result.rows[0];
  }

  /**
   * Get invoices by user ID (for users to see their invoices)
   */
  static async findByUserId(user_id) {
    const query = `
      SELECT * FROM invoices 
      WHERE user_id = $1 
      ORDER BY created_at DESC
    `;
    const result = await pool.query(query, [user_id]);
    return result.rows;
  }

  /**
   * Get invoices created by admin (for admins to see invoices they created)
   */
  static async findByCreatedBy(created_by) {
    const query = `
      SELECT * FROM invoices 
      WHERE created_by = $1 
      ORDER BY created_at DESC
    `;
    const result = await pool.query(query, [created_by]);
    return result.rows;
  }

  /**
   * Get all invoices with filters
   */
  static async findAll(filters = {}) {
    let query = 'SELECT * FROM invoices WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (filters.payment_status) {
      query += ` AND payment_status = $${paramCount}`;
      params.push(filters.payment_status);
      paramCount++;
    }

    if (filters.payment_method) {
      query += ` AND payment_method = $${paramCount}`;
      params.push(filters.payment_method);
      paramCount++;
    }

    if (filters.start_date) {
      query += ` AND created_at >= $${paramCount}`;
      params.push(filters.start_date);
      paramCount++;
    }

    if (filters.end_date) {
      query += ` AND created_at <= $${paramCount}`;
      params.push(filters.end_date);
      paramCount++;
    }

    query += ' ORDER BY created_at DESC';

    if (filters.limit) {
      query += ` LIMIT $${paramCount}`;
      params.push(filters.limit);
    }

    const result = await pool.query(query, params);
    return result.rows;
  }

  /**
   * Update invoice
   */
  static async update(id, data) {
    const {
      payment_status,
      transaction_id,
      notes
    } = data;

    const query = `
      UPDATE invoices 
      SET 
        payment_status = COALESCE($1, payment_status),
        transaction_id = COALESCE($2, transaction_id),
        notes = COALESCE($3, notes),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING *
    `;

    const result = await pool.query(query, [
      payment_status,
      transaction_id,
      notes,
      id
    ]);

    return result.rows[0];
  }

  /**
   * Delete invoice
   */
  static async delete(id) {
    const query = 'DELETE FROM invoices WHERE id = $1 RETURNING *';
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }
}

module.exports = Invoice;
