/**
 * =====================================================================
 * Sponsor Model
 * Company: emeelan
 * =====================================================================
 */

const pool = require('../config/database');

class Sponsor {
  static async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS temple_sponsorships (
        id SERIAL PRIMARY KEY,
        temple_id INTEGER NOT NULL,
        sponsored_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        sponsor_type VARCHAR(50) NOT NULL,
        payment_mode VARCHAR(50) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        payment_status VARCHAR(20) DEFAULT 'completed',
        duration_start DATE,
        duration_end DATE,
        receiver_name VARCHAR(255),
        receiver_user_id INTEGER REFERENCES users(id),
        receiver_father_name VARCHAR(255),
        receiver_gotra VARCHAR(100),
        notes TEXT,
        invoice_id INTEGER,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE temple_sponsorships ADD COLUMN IF NOT EXISTS receiver_user_id INTEGER REFERENCES users(id);
      ALTER TABLE temple_sponsorships ADD COLUMN IF NOT EXISTS receiver_father_name VARCHAR(255);
      ALTER TABLE temple_sponsorships ADD COLUMN IF NOT EXISTS receiver_gotra VARCHAR(100);

      CREATE INDEX IF NOT EXISTS idx_temple_sponsorships_temple ON temple_sponsorships(temple_id);
      CREATE INDEX IF NOT EXISTS idx_temple_sponsorships_user ON temple_sponsorships(sponsored_user_id);
      CREATE INDEX IF NOT EXISTS idx_temple_sponsorships_receiver_user ON temple_sponsorships(receiver_user_id);
      CREATE INDEX IF NOT EXISTS idx_temple_sponsorships_created_at ON temple_sponsorships(created_at);
    `;

    await pool.query(query);
  }

  static async create(data) {
    const {
      temple_id,
      sponsored_user_id,
      sponsor_type,
      payment_mode,
      amount,
      payment_status = 'completed',
      duration_start = null,
      duration_end = null,
      receiver_name = null,
      notes = null,
      invoice_id = null,
      receiver_user_id = null,
      receiver_father_name = null,
      receiver_gotra = null,
      created_by = null,
    } = data;

    const result = await pool.query(
      `INSERT INTO temple_sponsorships (
        temple_id, sponsored_user_id, sponsor_type, payment_mode, amount,
        payment_status, duration_start, duration_end, receiver_name, receiver_user_id, receiver_father_name, receiver_gotra, notes,
        invoice_id, created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      RETURNING *`,
      [
        temple_id,
        sponsored_user_id,
        sponsor_type,
        payment_mode,
        amount,
        payment_status,
        duration_start,
        duration_end,
        receiver_name,
        receiver_user_id,
        receiver_father_name,
        receiver_gotra,
        notes,
        invoice_id,
        created_by,
      ]
    );

    return result.rows[0];
  }

  static async getByTemple(templeId) {
    const result = await pool.query(
      `SELECT
        s.*,
        u.first_name,
        u.father_name,
        u.gotra,
        u.email,
        u.phone,
        COALESCE(u.profile_photo_url, u.photo_url) AS photo_url,
        (u.first_name || ' ' || COALESCE(u.last_name, '')) AS user_name,
        i.invoice_number,
        ru.first_name AS receiver_first_name,
        ru.father_name AS receiver_father_name_user,
        ru.gotra AS receiver_gotra_user
      FROM temple_sponsorships s
      JOIN users u ON u.id = s.sponsored_user_id
      LEFT JOIN invoices i ON i.id = s.invoice_id
      LEFT JOIN users ru ON ru.id = s.receiver_user_id
      WHERE s.temple_id = $1
      ORDER BY s.created_at DESC`,
      [templeId]
    );

    return result.rows;
  }
}

module.exports = Sponsor;
