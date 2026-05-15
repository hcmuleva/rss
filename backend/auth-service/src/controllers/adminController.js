/**
 * =====================================================================
 * Admin Controller
 * Company: emeelan
 * =====================================================================
 */

const User = require('../models/User');
const ablyService = require('../services/ablyService');

/**
 * @route   GET /api/admin/users
 * @desc    Get all users
 * @access  Admin/SuperAdmin
 */
const getAllUsers = async (req, res) => {
  try {
    const users = await User.findAll(req.query);

    res.status(200).json({
      success: true,
      data: {
        users: users.map(user => ({
          id: user.id,
          slug: user.slug,
          firstName: user.first_name,
          fatherName: user.father_name,
          dob: user.dob,
          gotra: user.gotra,
          email: user.email,
          role: user.role,
          isActive: user.is_active,
          createdAt: user.created_at,
          lastLogin: user.last_login,
        })),
        total: users.length,
      },
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get users',
    });
  }
};

/**
 * @route   PUT /api/admin/users/:userId/role
 * @desc    Update user role
 * @access  SuperAdmin only
 */
const updateUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    // Validate role
    const validRoles = ['user', 'admin', 'superadmin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Must be user, admin, or superadmin',
      });
    }

    // Only superadmin can change roles
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Only superadmin can change user roles',
      });
    }

    const updatedUser = await User.updateRole(userId, role);

    // Send real-time notification to the user
    ablyService.notifyRoleChange(parseInt(userId), role);

    res.status(200).json({
      success: true,
      message: 'User role updated successfully',
      data: {
        user: {
          id: updatedUser.id,
          slug: updatedUser.slug,
          firstName: updatedUser.first_name,
          fatherName: updatedUser.father_name,
          email: updatedUser.email,
          role: updatedUser.role,
        },
      },
    });
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user role',
    });
  }
};

/**
 * @route   POST /api/admin/users
 * @desc    Create new user (admin can create)
 * @access  Admin/SuperAdmin
 */
const createUser = async (req, res) => {
  try {
    const { 
      firstName, fatherName, dob, gotra, email, password, role = 'user',
      assignmentLevel = 'village', state, district, tehsil, village 
    } = req.body;

    // Validate input
    if (!firstName || !fatherName || !dob || !gotra || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields',
      });
    }

    // Only superadmin can create admin/superadmin users
    if ((role === 'admin' || role === 'superadmin') && req.user.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Only superadmin can create admin users',
      });
    }

    const user = await User.create({
      firstName,
      fatherName,
      dob,
      gotra,
      email,
      password,
      role,
      assignmentLevel,
      state,
      district,
      tehsil,
      village,
    });

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {
        user: {
          id: user.id,
          slug: user.slug,
          firstName: user.first_name,
          fatherName: user.father_name,
          dob: user.dob,
          gotra: user.gotra,
          email: user.email,
          role: user.role,
          assignmentLevel: user.assignment_level,
          state: user.state,
          district: user.district,
          tehsil: user.tehsil,
          village: user.village,
        },
      },
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create user',
    });
  }
};

/**
 * @route   GET /api/admin/users/paginated
 * @desc    Get paginated users with filtering and sorting
 * @access  Admin/SuperAdmin
 */
const getPaginatedUsers = async (req, res) => {
  try {
    const {
      // Pagination
      page = 1,
      pageSize = 50,
      
      // Filters
      nameSearch,
      emailSearch,
      phoneSearch,
      state,
      district,
      tehsil,
      village,
      role,
      isActive,
      gotra,
      
      // Sorting
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(pageSize);
    const limit = parseInt(pageSize);

    // Use direct pool for complex queries
    const pool = require('../config/database');

    // Build WHERE clause dynamically
    const whereConditions = [];
    const params = [];
    let paramIndex = 1;

    if (nameSearch) {
      whereConditions.push(`(u.first_name ILIKE $${paramIndex} OR u.middle_name ILIKE $${paramIndex} OR u.last_name ILIKE $${paramIndex} OR u.father_name ILIKE $${paramIndex})`);
      params.push(`%${nameSearch}%`);
      paramIndex++;
    }

    if (emailSearch) {
      whereConditions.push(`u.email ILIKE $${paramIndex}`);
      params.push(`%${emailSearch}%`);
      paramIndex++;
    }

    if (phoneSearch) {
      whereConditions.push(`u.phone ILIKE $${paramIndex}`);
      params.push(`%${phoneSearch}%`);
      paramIndex++;
    }

    if (state) {
      whereConditions.push(`u.state = $${paramIndex}`);
      params.push(state);
      paramIndex++;
    }
    if (district) {
      whereConditions.push(`u.district ILIKE $${paramIndex}`);
      params.push(`%${district}%`);
      paramIndex++;
    }
    if (tehsil) {
      whereConditions.push(`u.tehsil ILIKE $${paramIndex}`);
      params.push(`%${tehsil}%`);
      paramIndex++;
    }
    if (village) {
      whereConditions.push(`u.village ILIKE $${paramIndex}`);
      params.push(`%${village}%`);
      paramIndex++;
    }

    if (role) {
      whereConditions.push(`u.role = $${paramIndex}`);
      params.push(role);
      paramIndex++;
    }

    if (isActive !== undefined && isActive !== '') {
      whereConditions.push(`u.is_active = $${paramIndex}`);
      params.push(isActive === 'true' || isActive === true);
      paramIndex++;
    }

    if (gotra) {
      whereConditions.push(`u.gotra ILIKE $${paramIndex}`);
      params.push(`%${gotra}%`);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    // Validate sort column
    const validSortColumns = {
      'full_name': 'u.first_name',
      'email': 'u.email',
      'phone': 'u.phone',
      'role': 'u.role',
      'is_active': 'u.is_active',
      'state': 'u.state',
      'district': 'u.district',
      'created_at': 'u.created_at'
    };

    const orderColumn = validSortColumns[sortBy] || 'u.created_at';
    const orderDirection = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM users u
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
        u.father_name,
        u.email,
        u.phone,
        u.role,
        u.is_active,
        u.gotra,
        u.gender,
        u.marital_status,
        u.dob,
        u.assignment_level,
        u.state,
        u.district,
        u.tehsil,
        u.village,
        u.created_at,
        u.last_login
      FROM users u
      ${whereClause}
      ORDER BY ${orderColumn} ${orderDirection}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);
    const dataResult = await pool.query(dataQuery, params);

    const totalPages = Math.ceil(totalRecords / limit);
    const currentPage = parseInt(page);

    res.status(200).json({
      success: true,
      data: dataResult.rows,
      pagination: {
        page: currentPage,
        pageSize: limit,
        totalRecords,
        totalPages,
        hasNextPage: currentPage < totalPages,
        hasPrevPage: currentPage > 1
      }
    });

  } catch (error) {
    console.error('Get paginated users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get users',
      error: error.message
    });
  }
};

/**
 * @route   GET /api/admin/users/search
 * @desc    Search users by mobile, email, or user ID for temple admin assignment
 * @access  Admin/SuperAdmin
 */
const searchUsers = async (req, res) => {
  try {
    const query = String(req.query.query || '');
    const normalizedQuery = query.trim();

    if (!normalizedQuery || normalizedQuery.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters'
      });
    }

    const pool = require('../config/database');
    
    // Search by phone, email, ID, or name
    // Return ALL user fields for memorial page auto-fill
    const searchQuery = `
      SELECT 
        u.id,
        u.slug,
        u.first_name,
        u.middle_name,
        u.last_name,
        u.father_name,
        u.email,
        u.phone,
        u.role,
        u.gotra,
        u.gender,
        u.marital_status,
        u.dob,
        u.profile_photo_url as photo_url,
        u.is_active,
        u.created_at,
        u.assignment_level,
        u.state as user_state,
        u.district as user_district,
        u.tehsil as user_tehsil,
        u.village as user_village
      FROM users u
      WHERE 
        u.phone ILIKE $1 OR
        u.email ILIKE $1 OR
        LOWER(u.email) = LOWER($2) OR
        CAST(u.id AS TEXT) = $2 OR
        u.first_name ILIKE $1 OR
        u.last_name ILIKE $1 OR
        u.father_name ILIKE $1 OR
        u.slug ILIKE $1
      LIMIT 20
    `;

    const result = await pool.query(searchQuery, [`%${normalizedQuery}%`, normalizedQuery]);

    res.status(200).json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search users',
      error: error.message
    });
  }
};

/**
 * Create a new temple admin user
 * POST /api/admin/create-temple-admin
 */
const createTempleAdmin = async (req, res) => {
  try {
    const { firstName, lastName, email, phone, templeId } = req.body;
    const creatorId = req.user.id; // Superadmin creating the user

    // Validate required fields
    if (!firstName || !email || !templeId) {
      return res.status(400).json({
        success: false,
        message: 'First name, email, and temple ID are required'
      });
    }

    const pool = require('../config/database');
    const bcrypt = require('bcrypt');
    const crypto = require('crypto');

    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Generate random password
    const randomPassword = crypto.randomBytes(8).toString('hex').substring(0, 12);
    const hashedPassword = await bcrypt.hash(randomPassword, 10);

    // Create user
    const userResult = await pool.query(
      `INSERT INTO users 
        (first_name, last_name, email, phone, password, role, created_by, created_at) 
       VALUES ($1, $2, $3, $4, $5, 'admin', $6, NOW())
       RETURNING id, first_name, last_name, email, phone, role`,
      [firstName, lastName || '', email, phone || '', hashedPassword, creatorId]
    );

    const newUser = userResult.rows[0];

    // Assign user to temple
    await pool.query(
      `INSERT INTO user_temples 
        (user_id, temple_id, role, admin_level, is_active, created_by, created_at)
       VALUES ($1, $2, 'admin', 'temple', true, $3, NOW())`,
      [newUser.id, templeId, creatorId]
    );

    // Log credentials (TODO: Send via email)
    console.log(`
      ═══════════════════════════════════════════════════
      New Temple Admin Created
      ═══════════════════════════════════════════════════
      Name: ${firstName} ${lastName || ''}
      Email: ${email}
      Temporary Password: ${randomPassword}
      Temple ID: ${templeId}
      ═══════════════════════════════════════════════════
      Please send these credentials to the admin via email.
    `);

    res.json({
      success: true,
      message: 'Temple admin created successfully',
      data: {
        user: {
          id: newUser.id,
          firstName: newUser.first_name,
          lastName: newUser.last_name,
          email: newUser.email,
          phone: newUser.phone,
          role: newUser.role
        },
        temporaryPassword: randomPassword, // In production, don't return this, send via email
        templeId
      }
    });
  } catch (error) {
    console.error('Create temple admin error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create temple admin',
      error: error.message
    });
  }
};

module.exports = {
  getAllUsers,
  updateUserRole,
  createUser,
  getPaginatedUsers,
  searchUsers,
  createTempleAdmin,
};
