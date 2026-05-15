/**
 * Paginated Analytics Controller
 * Handles large datasets (1M+ records) with server-side pagination, filtering, sorting
 */

const pool = require('../config/database');

/**
 * Get Paginated Members List
 * Supports filtering, sorting, and pagination for millions of records
 */
exports.getPaginatedMembers = async (req, res) => {
  try {
    const {
      // Pagination
      page = 1,
      pageSize = 50,
      
      // Filters
      templeId,
      state,
      district,
      tehsil,
      village,
      gotraId,
      gender,
      maritalStatus,
      ageMin,
      ageMax,
      nameSearch,
      phoneSearch,
      
      // Sorting
      sortBy = 'name',
      sortOrder = 'asc'
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(pageSize);
    const limit = parseInt(pageSize);

    // Build WHERE clause dynamically
    const whereConditions = [];
    const params = [];
    let paramIndex = 1;

    if (templeId) {
      whereConditions.push(`u.temple_id = $${paramIndex++}`);
      params.push(templeId);
    }

    if (state) {
      whereConditions.push(`f.state = $${paramIndex++}`);
      params.push(state);
    }

    if (district) {
      whereConditions.push(`f.district = $${paramIndex++}`);
      params.push(district);
    }

    if (tehsil) {
      whereConditions.push(`f.tehsil = $${paramIndex++}`);
      params.push(tehsil);
    }

    if (village) {
      whereConditions.push(`f.village = $${paramIndex++}`);
      params.push(village);
    }

    if (gotraId) {
      whereConditions.push(`u.gotra = $${paramIndex++}`);
      params.push(gotraId);
    }

    if (gender) {
      whereConditions.push(`u.gender = $${paramIndex++}`);
      params.push(gender);
    }

    if (maritalStatus) {
      whereConditions.push(`u.marital_status = $${paramIndex++}`);
      params.push(maritalStatus);
    }

    if (ageMin) {
      whereConditions.push(`EXTRACT(YEAR FROM AGE(u.dob)) >= $${paramIndex++}`);
      params.push(parseInt(ageMin));
    }

    if (ageMax) {
      whereConditions.push(`EXTRACT(YEAR FROM AGE(u.dob)) <= $${paramIndex++}`);
      params.push(parseInt(ageMax));
    }

    if (nameSearch) {
      whereConditions.push(`(u.first_name ILIKE $${paramIndex} OR u.last_name ILIKE $${paramIndex})`);
      params.push(`%${nameSearch}%`);
      paramIndex++;
    }

    if (phoneSearch) {
      whereConditions.push(`u.phone ILIKE $${paramIndex++}`);
      params.push(`%${phoneSearch}%`);
    }

    const whereClause = whereConditions.length > 0
      ? 'WHERE ' + whereConditions.join(' AND ')
      : '';

    // Validate sort column (prevent SQL injection)
    const allowedSortColumns = {
      'name': 'u.first_name',
      'age': 'u.dob',
      'gender': 'u.gender',
      'marital_status': 'u.marital_status',
      'state': 'f.state',
      'district': 'f.district',
      'phone': 'u.phone',
      'created_at': 'u.created_at'
    };
    const sortColumn = allowedSortColumns[sortBy] || 'u.first_name';
    const sortDirection = sortOrder.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    // Get total count (for pagination metadata)
    const countQuery = `
      SELECT COUNT(*) as total
      FROM users u
      LEFT JOIN families f ON u.family_id = f.id
      ${whereClause}
    `;
    const countResult = await pool.query(countQuery, params);
    const totalRecords = parseInt(countResult.rows[0].total);

    // Get paginated data
    const dataQuery = `
      SELECT 
        u.id,
        u.first_name,
        u.middle_name,
        u.last_name,
        CONCAT_WS(' ', u.first_name, u.middle_name, u.last_name) as full_name,
        u.father_name,
        u.dob,
        EXTRACT(YEAR FROM AGE(u.dob)) as age,
        u.gender,
        u.marital_status,
        u.phone,
        u.email,
        u.gotra,
        u.profile_photo_url,
        f.state,
        f.district,
        f.tehsil,
        f.village,
        f.pincode,
        t.name as temple_name,
        f.name as family_name,
        u.created_at
      FROM users u
      LEFT JOIN families f ON u.family_id = f.id
      LEFT JOIN temples t ON u.temple_id = t.id
      ${whereClause}
      ORDER BY ${sortColumn} ${sortDirection}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const dataResult = await pool.query(dataQuery, [
      ...params,
      limit,
      offset
    ]);

    res.json({
      success: true,
      data: dataResult.rows,
      pagination: {
        page: parseInt(page),
        pageSize: limit,
        totalRecords: totalRecords,
        totalPages: Math.ceil(totalRecords / limit),
        hasNextPage: offset + limit < totalRecords,
        hasPrevPage: parseInt(page) > 1
      },
      filters: {
        state,
        district,
        tehsil,
        village,
        gotraId,
        gender,
        maritalStatus,
        ageMin,
        ageMax,
        nameSearch,
        phoneSearch
      },
      sort: {
        column: sortBy,
        order: sortOrder
      }
    });

  } catch (error) {
    console.error('Get paginated members error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch members list'
    });
  }
};

/**
 * Get Paginated Families List
 */
exports.getPaginatedFamilies = async (req, res) => {
  try {
    const {
      page = 1,
      pageSize = 50,
      templeId,
      state,
      district,
      tehsil,
      village,
      gotraId,
      hasLand,
      minLandAcres,
      maxLandAcres,
      minIncome,
      maxIncome,
      familyNameSearch,
      sortBy = 'family_name',
      sortOrder = 'asc'
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(pageSize);
    const limit = parseInt(pageSize);

    const whereConditions = [];
    const params = [];
    let paramIndex = 1;

    if (templeId) {
      whereConditions.push(`f.temple_id = $${paramIndex++}`);
      params.push(templeId);
    }

    if (state) {
      whereConditions.push(`f.state = $${paramIndex++}`);
      params.push(state);
    }

    if (district) {
      whereConditions.push(`f.district = $${paramIndex++}`);
      params.push(district);
    }

    if (tehsil) {
      whereConditions.push(`f.tehsil = $${paramIndex++}`);
      params.push(tehsil);
    }

    if (village) {
      whereConditions.push(`f.village = $${paramIndex++}`);
      params.push(village);
    }

    if (gotraId) {
      whereConditions.push(`f.gotra = $${paramIndex++}`);
      params.push(gotraId);
    }

    if (hasLand === 'true') {
      whereConditions.push(`f.agriculture_land_acres > 0`);
    } else if (hasLand === 'false') {
      whereConditions.push(`(f.agriculture_land_acres IS NULL OR f.agriculture_land_acres = 0)`);
    }

    if (minLandAcres) {
      whereConditions.push(`f.agriculture_land_acres >= $${paramIndex++}`);
      params.push(parseFloat(minLandAcres));
    }

    if (maxLandAcres) {
      whereConditions.push(`f.agriculture_land_acres <= $${paramIndex++}`);
      params.push(parseFloat(maxLandAcres));
    }

    if (minIncome) {
      whereConditions.push(`f.agriculture_income_yearly >= $${paramIndex++}`);
      params.push(parseFloat(minIncome));
    }

    if (maxIncome) {
      whereConditions.push(`f.agriculture_income_yearly <= $${paramIndex++}`);
      params.push(parseFloat(maxIncome));
    }

    if (familyNameSearch) {
      whereConditions.push(`f.family_name ILIKE $${paramIndex++}`);
      params.push(`%${familyNameSearch}%`);
    }

    const whereClause = whereConditions.length > 0
      ? 'WHERE ' + whereConditions.join(' AND ')
      : '';

    const allowedSortColumns = {
      'name': 'f.name',
      'state': 'f.state',
      'district': 'f.district',
      'agriculture_land_acres': 'f.agriculture_land_acres',
      'agriculture_income_yearly': 'f.agriculture_income_yearly',
      'created_at': 'f.created_at'
    };
    const sortColumn = allowedSortColumns[sortBy] || 'f.name';
    const sortDirection = sortOrder.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM families f
      ${whereClause}
    `;
    const countResult = await pool.query(countQuery, params);
    const totalRecords = parseInt(countResult.rows[0].total);

    // Get paginated data
    const dataQuery = `
      SELECT 
        f.id,
        f.name as family_name,
        f.state,
        f.district,
        f.tehsil,
        f.village,
        f.pincode,
        f.agriculture_land_acres,
        f.agriculture_land_type,
        f.agriculture_crops,
        f.agriculture_income_yearly,
        f.gotra,
        t.name as temple_name,
        f.head_of_family_name,
        (SELECT COUNT(*) FROM users WHERE family_id = f.id) as member_count,
        f.created_at
      FROM families f
      LEFT JOIN temples t ON f.temple_id = t.id
      ${whereClause}
      ORDER BY ${sortColumn} ${sortDirection}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const dataResult = await pool.query(dataQuery, [
      ...params,
      limit,
      offset
    ]);

    res.json({
      success: true,
      data: dataResult.rows,
      pagination: {
        page: parseInt(page),
        pageSize: limit,
        totalRecords: totalRecords,
        totalPages: Math.ceil(totalRecords / limit),
        hasNextPage: offset + limit < totalRecords,
        hasPrevPage: parseInt(page) > 1
      }
    });

  } catch (error) {
    console.error('Get paginated families error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch families list'
    });
  }
};

/**
 * Get Filter Options
 * Returns unique values for dropdown filters
 */
exports.getFilterOptions = async (req, res) => {
  try {
    const { type, state, district } = req.query;

    let query;
    let params = [];

    switch (type) {
      case 'states':
        query = `SELECT DISTINCT state FROM families WHERE state IS NOT NULL ORDER BY state`;
        break;

      case 'districts':
        if (state) {
          query = `SELECT DISTINCT district FROM families WHERE state = $1 AND district IS NOT NULL ORDER BY district`;
          params = [state];
        } else {
          query = `SELECT DISTINCT district FROM families WHERE district IS NOT NULL ORDER BY district`;
        }
        break;

      case 'tehsils':
        if (state && district) {
          query = `SELECT DISTINCT tehsil FROM families WHERE state = $1 AND district = $2 AND tehsil IS NOT NULL ORDER BY tehsil`;
          params = [state, district];
        } else if (state) {
          query = `SELECT DISTINCT tehsil FROM families WHERE state = $1 AND tehsil IS NOT NULL ORDER BY tehsil`;
          params = [state];
        } else {
          query = `SELECT DISTINCT tehsil FROM families WHERE tehsil IS NOT NULL ORDER BY tehsil`;
        }
        break;

      case 'gotras':
        query = `SELECT DISTINCT gotra FROM users WHERE gotra IS NOT NULL UNION SELECT DISTINCT gotra FROM families WHERE gotra IS NOT NULL ORDER BY gotra`;
        break;

      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid filter type'
        });
    }

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error('Get filter options error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch filter options'
    });
  }
};

module.exports = exports;
