/**
 * =====================================================================
 * Education Controller
 * Company: emeelan
 * Description: Handle user education operations (Education Tab)
 * =====================================================================
 */

const pool = require('../config/database');

let educationTableEnsured = false;

const ensureEducationTable = async () => {
  if (educationTableEnsured) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_education (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      degree VARCHAR(100) NOT NULL,
      field_of_study VARCHAR(100) NOT NULL,
      institution VARCHAR(200) NOT NULL,
      university VARCHAR(200),
      start_date DATE NOT NULL,
      end_date DATE,
      is_current BOOLEAN DEFAULT false,
      grade VARCHAR(20),
      achievements TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_education_user_id ON user_education(user_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_education_degree ON user_education(degree)`);
  educationTableEnsured = true;
};

/**
 * @route   GET /api/profile/education
 * @desc    Get all education records for current user
 * @access  Private
 */
exports.getAllEducation = async (req, res) => {
  try {
    await ensureEducationTable();
    const userId = req.user.id;

    const query = `
      SELECT 
        id,
        user_id as "userId",
        degree,
        field_of_study as "fieldOfStudy",
        institution,
        university,
        TO_CHAR(start_date, 'YYYY-MM') as "startDate",
        TO_CHAR(end_date, 'YYYY-MM') as "endDate",
        is_current as "isCurrent",
        grade,
        achievements,
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM user_education
      WHERE user_id = $1
      ORDER BY start_date DESC, id DESC
    `;

    const result = await pool.query(query, [userId]);

    res.status(200).json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get education error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

/**
 * @route   POST /api/profile/education
 * @desc    Add new education record
 * @access  Private
 */
exports.addEducation = async (req, res) => {
  try {
    await ensureEducationTable();
    const userId = req.user.id;
    const {
      degree,
      fieldOfStudy,
      institution,
      university,
      startDate,
      endDate,
      isCurrent,
      grade,
      achievements,
    } = req.body;

    // Validation
    if (!degree || !fieldOfStudy || !institution || !startDate) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: {
          field: 'required',
          message: 'degree, fieldOfStudy, institution, and startDate are required',
        },
      });
    }

    // Validate date format (YYYY-MM or YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}(-\d{2})?$/;
    if (!dateRegex.test(startDate)) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: {
          field: 'startDate',
          message: 'Start date must be in YYYY-MM or YYYY-MM-DD format',
        },
      });
    }

    if (endDate && !dateRegex.test(endDate)) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: {
          field: 'endDate',
          message: 'End date must be in YYYY-MM or YYYY-MM-DD format',
        },
      });
    }

    // Validate endDate is after startDate
    if (endDate && new Date(endDate) < new Date(startDate)) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: {
          field: 'endDate',
          message: 'End date must be after start date',
        },
      });
    }

    // Helper function to convert YYYY-MM to YYYY-MM-01 for PostgreSQL date type
    const formatDateForDB = (dateStr) => {
      if (!dateStr) return null;
      // If format is YYYY-MM, add -01 to make it YYYY-MM-DD
      if (/^\d{4}-\d{2}$/.test(dateStr)) {
        return `${dateStr}-01`;
      }
      return dateStr;
    };

    // Insert education record
    const query = `
      INSERT INTO user_education (
        user_id,
        degree,
        field_of_study,
        institution,
        university,
        start_date,
        end_date,
        is_current,
        grade,
        achievements
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING 
        id,
        user_id as "userId",
        degree,
        field_of_study as "fieldOfStudy",
        institution,
        university,
        TO_CHAR(start_date, 'YYYY-MM') as "startDate",
        TO_CHAR(end_date, 'YYYY-MM') as "endDate",
        is_current as "isCurrent",
        grade,
        achievements,
        created_at as "createdAt",
        updated_at as "updatedAt"
    `;

    const values = [
      userId,
      degree,
      fieldOfStudy,
      institution,
      university || null,
      formatDateForDB(startDate),
      formatDateForDB(endDate),
      isCurrent || false,
      grade || null,
      achievements || null,
    ];

    const result = await pool.query(query, values);

    res.status(201).json({
      success: true,
      message: 'Education record added successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Add education error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

/**
 * @route   PUT /api/profile/education/:id
 * @desc    Update education record
 * @access  Private
 */
exports.updateEducation = async (req, res) => {
  try {
    await ensureEducationTable();
    const userId = req.user.id;
    const educationId = req.params.id;
    const {
      degree,
      fieldOfStudy,
      institution,
      university,
      startDate,
      endDate,
      isCurrent,
      grade,
      achievements,
    } = req.body;

    // Validation
    if (!degree || !fieldOfStudy || !institution || !startDate) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: {
          field: 'required',
          message: 'degree, fieldOfStudy, institution, and startDate are required',
        },
      });
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}(-\d{2})?$/;
    if (!dateRegex.test(startDate)) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: {
          field: 'startDate',
          message: 'Start date must be in YYYY-MM or YYYY-MM-DD format',
        },
      });
    }

    if (endDate && !dateRegex.test(endDate)) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: {
          field: 'endDate',
          message: 'End date must be in YYYY-MM or YYYY-MM-DD format',
        },
      });
    }

    // Validate endDate is after startDate
    if (endDate && new Date(endDate) < new Date(startDate)) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: {
          field: 'endDate',
          message: 'End date must be after start date',
        },
      });
    }

    // Helper function to convert YYYY-MM to YYYY-MM-01 for PostgreSQL date type
    const formatDateForDB = (dateStr) => {
      if (!dateStr) return null;
      // If format is YYYY-MM, add -01 to make it YYYY-MM-DD
      if (/^\d{4}-\d{2}$/.test(dateStr)) {
        return `${dateStr}-01`;
      }
      return dateStr;
    };

    // Check if education record exists and belongs to user
    const checkQuery = `
      SELECT id FROM user_education 
      WHERE id = $1 AND user_id = $2
    `;
    const checkResult = await pool.query(checkQuery, [educationId, userId]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Education record not found or unauthorized',
      });
    }

    // Update education record
    const query = `
      UPDATE user_education
      SET 
        degree = $1,
        field_of_study = $2,
        institution = $3,
        university = $4,
        start_date = $5,
        end_date = $6,
        is_current = $7,
        grade = $8,
        achievements = $9,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $10 AND user_id = $11
      RETURNING 
        id,
        user_id as "userId",
        degree,
        field_of_study as "fieldOfStudy",
        institution,
        university,
        TO_CHAR(start_date, 'YYYY-MM') as "startDate",
        TO_CHAR(end_date, 'YYYY-MM') as "endDate",
        is_current as "isCurrent",
        grade,
        achievements,
        created_at as "createdAt",
        updated_at as "updatedAt"
    `;

    const values = [
      degree,
      fieldOfStudy,
      institution,
      university || null,
      formatDateForDB(startDate),
      formatDateForDB(endDate),
      isCurrent || false,
      grade || null,
      achievements || null,
      educationId,
      userId,
    ];

    const result = await pool.query(query, values);

    res.status(200).json({
      success: true,
      message: 'Education record updated successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Update education error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

/**
 * @route   DELETE /api/profile/education/:id
 * @desc    Delete education record
 * @access  Private
 */
exports.deleteEducation = async (req, res) => {
  try {
    await ensureEducationTable();
    const userId = req.user.id;
    const educationId = req.params.id;

    // Check if education record exists and belongs to user
    const checkQuery = `
      SELECT id FROM user_education 
      WHERE id = $1 AND user_id = $2
    `;
    const checkResult = await pool.query(checkQuery, [educationId, userId]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Education record not found or unauthorized',
      });
    }

    // Delete education record
    const deleteQuery = `
      DELETE FROM user_education 
      WHERE id = $1 AND user_id = $2
    `;
    await pool.query(deleteQuery, [educationId, userId]);

    res.status(200).json({
      success: true,
      message: 'Education record deleted successfully',
    });
  } catch (error) {
    console.error('Delete education error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

module.exports = exports;
