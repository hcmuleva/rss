/**
 * =====================================================================
 * Jobs Controller
 * Company: emeelan
 * Description: Handle user job/employment operations (Jobs Tab)
 * =====================================================================
 */

const pool = require('../config/database');

/**
 * @route   GET /api/profile/jobs
 * @desc    Get all job records for current user
 * @access  Private
 */
exports.getAllJobs = async (req, res) => {
  try {
    const userId = req.user.id;

    const query = `
      SELECT 
        id,
        user_id as "userId",
        sector,
        company_name as "companyName",
        designation,
        department,
        industry,
        employment_type as "employmentType",
        TO_CHAR(start_date, 'YYYY-MM') as "startDate",
        TO_CHAR(end_date, 'YYYY-MM') as "endDate",
        is_current as "isCurrent",
        location,
        description,
        salary_range as "salaryRange",
        achievements,
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM user_jobs
      WHERE user_id = $1
      ORDER BY 
        CASE WHEN is_current = true THEN 0 ELSE 1 END,
        start_date DESC,
        id DESC
    `;

    const result = await pool.query(query, [userId]);

    res.status(200).json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get jobs error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

/**
 * @route   POST /api/profile/jobs
 * @desc    Add new job record
 * @access  Private
 */
exports.addJob = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      sector,
      companyName,
      designation,
      department,
      industry,
      employmentType,
      startDate,
      endDate,
      isCurrent,
      location,
      description,
      salaryRange,
      achievements,
    } = req.body;

    // Validation
    if (!sector || !companyName || !designation || !industry || !employmentType || !startDate) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: {
          field: 'required',
          message: 'sector, companyName, designation, industry, employmentType, and startDate are required',
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

    // Validate sector
    if (!['Government', 'Private'].includes(sector)) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: {
          field: 'sector',
          message: 'Sector must be either Government or Private',
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

    // Insert job record
    const query = `
      INSERT INTO user_jobs (
        user_id,
        sector,
        company_name,
        designation,
        department,
        industry,
        employment_type,
        start_date,
        end_date,
        is_current,
        location,
        description,
        salary_range,
        achievements
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING 
        id,
        user_id as "userId",
        sector,
        company_name as "companyName",
        designation,
        department,
        industry,
        employment_type as "employmentType",
        TO_CHAR(start_date, 'YYYY-MM') as "startDate",
        TO_CHAR(end_date, 'YYYY-MM') as "endDate",
        is_current as "isCurrent",
        location,
        description,
        salary_range as "salaryRange",
        achievements,
        created_at as "createdAt",
        updated_at as "updatedAt"
    `;

    const values = [
      userId,
      sector,
      companyName,
      designation,
      department || null,
      industry,
      employmentType,
      formatDateForDB(startDate),
      formatDateForDB(endDate),
      isCurrent || false,
      location || null,
      description || null,
      salaryRange || null,
      achievements || null,
    ];

    const result = await pool.query(query, values);

    res.status(201).json({
      success: true,
      message: 'Job record added successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Add job error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

/**
 * @route   PUT /api/profile/jobs/:id
 * @desc    Update job record
 * @access  Private
 */
exports.updateJob = async (req, res) => {
  try {
    const userId = req.user.id;
    const jobId = req.params.id;
    const {
      sector,
      companyName,
      designation,
      department,
      industry,
      employmentType,
      startDate,
      endDate,
      isCurrent,
      location,
      description,
      salaryRange,
      achievements,
    } = req.body;

    // Validation
    if (!sector || !companyName || !designation || !industry || !employmentType || !startDate) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: {
          field: 'required',
          message: 'sector, companyName, designation, industry, employmentType, and startDate are required',
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

    // Validate sector
    if (!['Government', 'Private'].includes(sector)) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: {
          field: 'sector',
          message: 'Sector must be either Government or Private',
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

    // Check if job record exists and belongs to user
    const checkQuery = `
      SELECT id FROM user_jobs 
      WHERE id = $1 AND user_id = $2
    `;
    const checkResult = await pool.query(checkQuery, [jobId, userId]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Job record not found or unauthorized',
      });
    }

    // Update job record
    const query = `
      UPDATE user_jobs
      SET 
        sector = $1,
        company_name = $2,
        designation = $3,
        department = $4,
        industry = $5,
        employment_type = $6,
        start_date = $7,
        end_date = $8,
        is_current = $9,
        location = $10,
        description = $11,
        salary_range = $12,
        achievements = $13,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $14 AND user_id = $15
      RETURNING 
        id,
        user_id as "userId",
        sector,
        company_name as "companyName",
        designation,
        department,
        industry,
        employment_type as "employmentType",
        TO_CHAR(start_date, 'YYYY-MM') as "startDate",
        TO_CHAR(end_date, 'YYYY-MM') as "endDate",
        is_current as "isCurrent",
        location,
        description,
        salary_range as "salaryRange",
        achievements,
        created_at as "createdAt",
        updated_at as "updatedAt"
    `;

    const values = [
      sector,
      companyName,
      designation,
      department || null,
      industry,
      employmentType,
      formatDateForDB(startDate),
      formatDateForDB(endDate),
      isCurrent || false,
      location || null,
      description || null,
      salaryRange || null,
      achievements || null,
      jobId,
      userId,
    ];

    const result = await pool.query(query, values);

    res.status(200).json({
      success: true,
      message: 'Job record updated successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Update job error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

/**
 * @route   DELETE /api/profile/jobs/:id
 * @desc    Delete job record
 * @access  Private
 */
exports.deleteJob = async (req, res) => {
  try {
    const userId = req.user.id;
    const jobId = req.params.id;

    // Check if job record exists and belongs to user
    const checkQuery = `
      SELECT id FROM user_jobs 
      WHERE id = $1 AND user_id = $2
    `;
    const checkResult = await pool.query(checkQuery, [jobId, userId]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Job record not found or unauthorized',
      });
    }

    // Delete job record
    const deleteQuery = `
      DELETE FROM user_jobs 
      WHERE id = $1 AND user_id = $2
    `;
    await pool.query(deleteQuery, [jobId, userId]);

    res.status(200).json({
      success: true,
      message: 'Job record deleted successfully',
    });
  } catch (error) {
    console.error('Delete job error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

module.exports = exports;
