const pool = require('../config/database');

const DEFAULT_SUBCATEGORIES = [
  {
    category: 'संस्कृति प्रमुख',
    subcategories: [
      'साधु संत',
      'महंत',
      'मठ/मन्दिर के ट्रस्टी',
      'पुजारी पुरोहित',
      'भगत',
      'बड़वा',
      'तडवी पटेल',
      'कथाकार प्रवचनकार',
      'तांत्रिक',
      'मांत्रिक',
      'ज्योतिष',
      'भजनमण्डली',
      'सुन्दरकाण्ड',
      'धार्मिक संगठन',
    ],
  },
  { category: 'निधी प्रमुख', subcategories: ['व्यवसायी', 'उद्योगपति', 'कर्मचारी', 'कृषक', 'CA'] },
  { category: 'विधी प्रमुख', subcategories: ['फौजदारी', 'दिवानी', 'राजस्व', 'नोटरी', 'सुचना का अधिकार'] },
  { category: 'प्रलेखन प्रमुख', subcategories: ['परियोजना प्रलेखन प्रमुख'] },
  { category: 'परियोजना प्रमुख', subcategories: ['चिन्हित परियोजना सुची', 'क्रियान्वित परियोजना', 'प्रमुख', 'टोली'] },
  {
    category: 'मातृशक्ति T-8',
    subcategories: [
      'सामाजिक क्षेत्र',
      'धार्मिक क्षेत्र',
      'शैक्षणिक क्षैत्र',
      'राजनैतिक क्षेत्र',
      'धार्मिक संस्था नवपंथ',
      'प्रवचन',
      'कथाकार',
      'शासकीय सेवा',
      'परावर्तित महीला',
    ],
  },
  { category: 'वंशावली प्रमुख', subcategories: ['वंशावली लेखक सुची'] },
  { category: 'पुर्णकालिक', subcategories: ['सुची', 'क्षेत्र', 'परियोजना'] },
];

class Subcategory {
  static async createTable() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS subcategories (
        id SERIAL PRIMARY KEY,
        category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await pool.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_subcategories_cat_name_active
       ON subcategories (category_id, lower(name)) WHERE is_active = true`
    );
  }

  static async seedDefaults() {
    const existing = await pool.query(`SELECT COUNT(*)::int AS total FROM subcategories`);
    if (Number(existing.rows[0]?.total || 0) > 0) return;

    const cats = await pool.query(`SELECT id, name FROM categories`);
    const nameToId = new Map(cats.rows.map((row) => [String(row.name).trim().toLowerCase(), row.id]));

    for (const entry of DEFAULT_SUBCATEGORIES) {
      const categoryId = nameToId.get(String(entry.category).trim().toLowerCase());
      if (!categoryId) continue;
      for (const name of entry.subcategories) {
        await pool.query(
          `INSERT INTO subcategories (category_id, name) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [categoryId, name]
        );
      }
    }
  }

  static async list({ categoryId = null, includeInactive = false } = {}) {
    const safeCategoryId = Number(categoryId);
    const hasCategory = Number.isFinite(safeCategoryId) && safeCategoryId > 0;
    const result = await pool.query(
      `SELECT s.id, s.category_id, s.name, s.is_active, s.created_by, s.created_at, s.updated_at,
              c.name AS category_name
       FROM subcategories s
       JOIN categories c ON c.id = s.category_id
       WHERE ($1::boolean = true OR s.is_active = true)
         AND ($2::boolean = false OR s.category_id = $3)
       ORDER BY c.name ASC, s.is_active DESC, s.name ASC`,
      [Boolean(includeInactive), hasCategory, hasCategory ? safeCategoryId : 0]
    );
    return result.rows;
  }

  static async create({ categoryId, name, createdBy }) {
    const safeCategoryId = Number(categoryId);
    const safeName = String(name || '').trim();
    if (!Number.isFinite(safeCategoryId) || safeCategoryId <= 0) throw new Error('Valid category is required');
    if (!safeName) throw new Error('Subcategory name is required');

    const cat = await pool.query(`SELECT id FROM categories WHERE id = $1 AND is_active = true LIMIT 1`, [safeCategoryId]);
    if (!cat.rows[0]) throw new Error('Category not found or inactive');

    const duplicate = await pool.query(
      `SELECT id FROM subcategories WHERE category_id = $1 AND lower(name) = lower($2) AND is_active = true LIMIT 1`,
      [safeCategoryId, safeName]
    );
    if (duplicate.rows[0]) throw new Error('Subcategory already exists in this category');

    const result = await pool.query(
      `INSERT INTO subcategories (category_id, name, created_by)
       VALUES ($1, $2, $3)
       RETURNING id, category_id, name, is_active, created_by, created_at, updated_at`,
      [safeCategoryId, safeName, createdBy || null]
    );
    return result.rows[0];
  }

  static async update({ id, name }) {
    const safeId = Number(id);
    const safeName = String(name || '').trim();
    if (!Number.isFinite(safeId) || safeId <= 0) throw new Error('Invalid subcategory id');
    if (!safeName) throw new Error('Subcategory name is required');

    const current = await pool.query(`SELECT category_id FROM subcategories WHERE id = $1`, [safeId]);
    if (!current.rows[0]) throw new Error('Subcategory not found');

    const duplicate = await pool.query(
      `SELECT id FROM subcategories
       WHERE category_id = $1 AND lower(name) = lower($2) AND is_active = true AND id <> $3 LIMIT 1`,
      [current.rows[0].category_id, safeName, safeId]
    );
    if (duplicate.rows[0]) throw new Error('Subcategory already exists in this category');

    const result = await pool.query(
      `UPDATE subcategories SET name = $1, updated_at = NOW() WHERE id = $2
       RETURNING id, category_id, name, is_active, created_by, created_at, updated_at`,
      [safeName, safeId]
    );
    return result.rows[0];
  }

  static async deactivate({ id }) {
    const safeId = Number(id);
    if (!Number.isFinite(safeId) || safeId <= 0) throw new Error('Invalid subcategory id');
    const result = await pool.query(
      `UPDATE subcategories SET is_active = false, updated_at = NOW() WHERE id = $1
       RETURNING id, category_id, name, is_active, created_by, created_at, updated_at`,
      [safeId]
    );
    if (!result.rows[0]) throw new Error('Subcategory not found');
    return result.rows[0];
  }

  static async reactivate({ id }) {
    const safeId = Number(id);
    if (!Number.isFinite(safeId) || safeId <= 0) throw new Error('Invalid subcategory id');
    const result = await pool.query(
      `UPDATE subcategories SET is_active = true, updated_at = NOW() WHERE id = $1
       RETURNING id, category_id, name, is_active, created_by, created_at, updated_at`,
      [safeId]
    );
    if (!result.rows[0]) throw new Error('Subcategory not found');
    return result.rows[0];
  }
}

module.exports = Subcategory;
