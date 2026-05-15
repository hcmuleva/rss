/**
 * =====================================================================
 * Business Controller
 * Company: emeelan
 * Description: Handle user business operations (Business Tab)
 * =====================================================================
 */

const pool = require('../config/database');

let businessTableEnsured = false;

const ensureBusinessTable = async () => {
  if (businessTableEnsured) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_business (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      business_type VARCHAR(50) NOT NULL,
      business_category VARCHAR(100) NOT NULL,
      business_name VARCHAR(200) NOT NULL,
      description TEXT,
      industry VARCHAR(100),
      established INTEGER,
      registration_number VARCHAR(100),
      gst_number VARCHAR(50),
      address TEXT,
      city VARCHAR(100),
      state VARCHAR(100),
      pincode VARCHAR(20),
      phone VARCHAR(20),
      email VARCHAR(255),
      website VARCHAR(255),
      number_of_employees INTEGER,
      annual_turnover DECIMAL(15,2),
      ownership_type VARCHAR(50),
      ownership_percentage DECIMAL(5,2),
      is_active BOOLEAN DEFAULT true,
      total_land DECIMAL(10,2),
      land_unit VARCHAR(20),
      land_type VARCHAR(100),
      land_location TEXT,
      education_type VARCHAR(100),
      courses_offered TEXT,
      medium_of_instruction VARCHAR(100),
      total_students INTEGER,
      affiliated_to VARCHAR(200),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_business_user_id ON user_business(user_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_business_type ON user_business(business_type)`);
  businessTableEnsured = true;
};

/**
 * @route   GET /api/profile/business
 * @desc    Get all business records for current user
 * @access  Private
 */
exports.getAllBusiness = async (req, res) => {
  try {
    await ensureBusinessTable();
    const userId = req.user.id;

    const query = `
      SELECT 
        id,
        user_id as "userId",
        business_type as "businessType",
        business_category as "businessCategory",
        business_name as "businessName",
        description,
        industry,
        established,
        registration_number as "registrationNumber",
        gst_number as "gstNumber",
        address,
        city,
        state,
        pincode,
        phone,
        email,
        website,
        number_of_employees as "numberOfEmployees",
        annual_turnover as "annualTurnover",
        ownership_type as "ownershipType",
        ownership_percentage as "ownershipPercentage",
        is_active as "isActive",
        total_land as "totalLand",
        land_unit as "landUnit",
        land_type as "landType",
        land_location as "landLocation",
        education_type as "educationType",
        courses_offered as "coursesOffered",
        medium_of_instruction as "mediumOfInstruction",
        total_students as "totalStudents",
        affiliated_to as "affiliatedTo",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM user_business
      WHERE user_id = $1
      ORDER BY created_at DESC
    `;

    const result = await pool.query(query, [userId]);

    res.status(200).json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get business error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

/**
 * @route   POST /api/profile/business
 * @desc    Add new business record
 * @access  Private
 */
exports.addBusiness = async (req, res) => {
  try {
    await ensureBusinessTable();
    const userId = req.user.id;
    const {
      businessType,
      businessCategory,
      businessName,
      description,
      industry,
      established,
      registrationNumber,
      gstNumber,
      address,
      city,
      state,
      pincode,
      phone,
      email,
      website,
      numberOfEmployees,
      annualTurnover,
      ownershipType,
      ownershipPercentage,
      isActive,
      // Agriculture-specific
      totalLand,
      landUnit,
      landType,
      landLocation,
      // Education-specific
      educationType,
      coursesOffered,
      mediumOfInstruction,
      totalStudents,
      affiliatedTo,
    } = req.body;

    // Common validation
    if (!businessType || !businessCategory || !businessName) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: {
          field: 'required',
          message: 'businessType, businessCategory, and businessName are required',
        },
      });
    }

    // Agriculture-specific validation
    if (businessType === 'Agriculture') {
      if (!totalLand || !landUnit || !landType || !landLocation) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          details: {
            field: 'agriculture',
            message: 'For Agriculture businesses, totalLand, landUnit, landType, and landLocation are required',
          },
        });
      }
    }

    // Education-specific validation
    if (businessType === 'Education') {
      if (!educationType || !coursesOffered || !totalStudents) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          details: {
            field: 'education',
            message: 'For Education businesses, educationType, coursesOffered, and totalStudents are required',
          },
        });
      }
    }

    // Validate established year if provided
    if (established) {
      const currentYear = new Date().getFullYear();
      if (established < 1900 || established > currentYear) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          details: {
            field: 'established',
            message: `Established year must be between 1900 and ${currentYear}`,
          },
        });
      }
    }

    // Validate ownership percentage if provided
    if (ownershipPercentage !== undefined && (ownershipPercentage < 0 || ownershipPercentage > 100)) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: {
          field: 'ownershipPercentage',
          message: 'Ownership percentage must be between 0 and 100',
        },
      });
    }

    // Insert business record
    const query = `
      INSERT INTO user_business (
        user_id,
        business_type,
        business_category,
        business_name,
        description,
        industry,
        established,
        registration_number,
        gst_number,
        address,
        city,
        state,
        pincode,
        phone,
        email,
        website,
        number_of_employees,
        annual_turnover,
        ownership_type,
        ownership_percentage,
        is_active,
        total_land,
        land_unit,
        land_type,
        land_location,
        education_type,
        courses_offered,
        medium_of_instruction,
        total_students,
        affiliated_to
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30)
      RETURNING 
        id,
        user_id as "userId",
        business_type as "businessType",
        business_category as "businessCategory",
        business_name as "businessName",
        description,
        industry,
        established,
        registration_number as "registrationNumber",
        gst_number as "gstNumber",
        address,
        city,
        state,
        pincode,
        phone,
        email,
        website,
        number_of_employees as "numberOfEmployees",
        annual_turnover as "annualTurnover",
        ownership_type as "ownershipType",
        ownership_percentage as "ownershipPercentage",
        is_active as "isActive",
        total_land as "totalLand",
        land_unit as "landUnit",
        land_type as "landType",
        land_location as "landLocation",
        education_type as "educationType",
        courses_offered as "coursesOffered",
        medium_of_instruction as "mediumOfInstruction",
        total_students as "totalStudents",
        affiliated_to as "affiliatedTo",
        created_at as "createdAt",
        updated_at as "updatedAt"
    `;

    const values = [
      userId,
      businessType,
      businessCategory,
      businessName,
      description || null,
      industry || null,
      established || null,
      registrationNumber || null,
      gstNumber || null,
      address || null,
      city || null,
      state || null,
      pincode || null,
      phone || null,
      email || null,
      website || null,
      numberOfEmployees || null,
      annualTurnover || null,
      ownershipType || null,
      ownershipPercentage || null,
      isActive !== undefined ? isActive : true,
      totalLand || null,
      landUnit || null,
      landType || null,
      landLocation || null,
      educationType || null,
      coursesOffered || null,
      mediumOfInstruction || null,
      totalStudents || null,
      affiliatedTo || null,
    ];

    const result = await pool.query(query, values);

    res.status(201).json({
      success: true,
      message: 'Business record added successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Add business error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

/**
 * @route   PUT /api/profile/business/:id
 * @desc    Update business record
 * @access  Private
 */
exports.updateBusiness = async (req, res) => {
  try {
    await ensureBusinessTable();
    const userId = req.user.id;
    const businessId = req.params.id;
    const {
      businessType,
      businessCategory,
      businessName,
      description,
      industry,
      established,
      registrationNumber,
      gstNumber,
      address,
      city,
      state,
      pincode,
      phone,
      email,
      website,
      numberOfEmployees,
      annualTurnover,
      ownershipType,
      ownershipPercentage,
      isActive,
      // Agriculture-specific
      totalLand,
      landUnit,
      landType,
      landLocation,
      // Education-specific
      educationType,
      coursesOffered,
      mediumOfInstruction,
      totalStudents,
      affiliatedTo,
    } = req.body;

    // Common validation
    if (!businessType || !businessCategory || !businessName) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: {
          field: 'required',
          message: 'businessType, businessCategory, and businessName are required',
        },
      });
    }

    // Agriculture-specific validation
    if (businessType === 'Agriculture') {
      if (!totalLand || !landUnit || !landType || !landLocation) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          details: {
            field: 'agriculture',
            message: 'For Agriculture businesses, totalLand, landUnit, landType, and landLocation are required',
          },
        });
      }
    }

    // Education-specific validation
    if (businessType === 'Education') {
      if (!educationType || !coursesOffered || !totalStudents) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          details: {
            field: 'education',
            message: 'For Education businesses, educationType, coursesOffered, and totalStudents are required',
          },
        });
      }
    }

    // Validate established year if provided
    if (established) {
      const currentYear = new Date().getFullYear();
      if (established < 1900 || established > currentYear) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          details: {
            field: 'established',
            message: `Established year must be between 1900 and ${currentYear}`,
          },
        });
      }
    }

    // Check if business record exists and belongs to user
    const checkQuery = `
      SELECT id FROM user_business 
      WHERE id = $1 AND user_id = $2
    `;
    const checkResult = await pool.query(checkQuery, [businessId, userId]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Business record not found or unauthorized',
      });
    }

    // Update business record
    const query = `
      UPDATE user_business
      SET 
        business_type = $1,
        business_category = $2,
        business_name = $3,
        description = $4,
        industry = $5,
        established = $6,
        registration_number = $7,
        gst_number = $8,
        address = $9,
        city = $10,
        state = $11,
        pincode = $12,
        phone = $13,
        email = $14,
        website = $15,
        number_of_employees = $16,
        annual_turnover = $17,
        ownership_type = $18,
        ownership_percentage = $19,
        is_active = $20,
        total_land = $21,
        land_unit = $22,
        land_type = $23,
        land_location = $24,
        education_type = $25,
        courses_offered = $26,
        medium_of_instruction = $27,
        total_students = $28,
        affiliated_to = $29,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $30 AND user_id = $31
      RETURNING 
        id,
        user_id as "userId",
        business_type as "businessType",
        business_category as "businessCategory",
        business_name as "businessName",
        description,
        industry,
        established,
        registration_number as "registrationNumber",
        gst_number as "gstNumber",
        address,
        city,
        state,
        pincode,
        phone,
        email,
        website,
        number_of_employees as "numberOfEmployees",
        annual_turnover as "annualTurnover",
        ownership_type as "ownershipType",
        ownership_percentage as "ownershipPercentage",
        is_active as "isActive",
        total_land as "totalLand",
        land_unit as "landUnit",
        land_type as "landType",
        land_location as "landLocation",
        education_type as "educationType",
        courses_offered as "coursesOffered",
        medium_of_instruction as "mediumOfInstruction",
        total_students as "totalStudents",
        affiliated_to as "affiliatedTo",
        created_at as "createdAt",
        updated_at as "updatedAt"
    `;

    const values = [
      businessType,
      businessCategory,
      businessName,
      description || null,
      industry || null,
      established || null,
      registrationNumber || null,
      gstNumber || null,
      address || null,
      city || null,
      state || null,
      pincode || null,
      phone || null,
      email || null,
      website || null,
      numberOfEmployees || null,
      annualTurnover || null,
      ownershipType || null,
      ownershipPercentage || null,
      isActive !== undefined ? isActive : true,
      totalLand || null,
      landUnit || null,
      landType || null,
      landLocation || null,
      educationType || null,
      coursesOffered || null,
      mediumOfInstruction || null,
      totalStudents || null,
      affiliatedTo || null,
      businessId,
      userId,
    ];

    const result = await pool.query(query, values);

    res.status(200).json({
      success: true,
      message: 'Business record updated successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Update business error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

/**
 * @route   DELETE /api/profile/business/:id
 * @desc    Delete business record
 * @access  Private
 */
exports.deleteBusiness = async (req, res) => {
  try {
    await ensureBusinessTable();
    const userId = req.user.id;
    const businessId = req.params.id;

    // Check if business record exists and belongs to user
    const checkQuery = `
      SELECT id FROM user_business 
      WHERE id = $1 AND user_id = $2
    `;
    const checkResult = await pool.query(checkQuery, [businessId, userId]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Business record not found or unauthorized',
      });
    }

    // Delete business record
    const deleteQuery = `
      DELETE FROM user_business 
      WHERE id = $1 AND user_id = $2
    `;
    await pool.query(deleteQuery, [businessId, userId]);

    res.status(200).json({
      success: true,
      message: 'Business record deleted successfully',
    });
  } catch (error) {
    console.error('Delete business error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

module.exports = exports;
