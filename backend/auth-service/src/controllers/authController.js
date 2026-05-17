/**
 * =====================================================================
 * Authentication Controller
 * Company: emeelan
 * =====================================================================
 */

const User = require('../models/User');
const { generateTokens, verifyToken } = require('../utils/jwt');

const buildRoleCategory = (role = 'member', occupation = '') => {
  const normalizedRole = String(role || 'member').replace(/[_-]/g, ' ').trim();
  const lowerOccupation = String(occupation || '').toLowerCase();
  if (lowerOccupation.includes('teacher') || lowerOccupation.includes('student')) {
    return `${normalizedRole} (Education)`;
  }
  return `${normalizedRole} (General)`;
};

const normalizeGender = (gender) => {
  const value = String(gender || '').trim().toLowerCase();
  if (['m', 'male', 'man', 'पुरुष'].includes(value)) return 'M';
  if (['f', 'female', 'woman', 'महिला'].includes(value)) return 'F';
  if (['o', 'other'].includes(value)) return 'O';
  return null;
};

const normalizeMaritalStatus = (status) => {
  const value = String(status || '').trim().toLowerCase();
  if (!value) return 'unmarried';
  if (['married', 'vivahit', 'विवाहित'].includes(value)) return 'married';
  if (['divorced', 'widowed'].includes(value)) return value;
  if (['single', 'unmarried', 'never married', 'अविवाहित'].includes(value)) return 'unmarried';
  return value;
};

const normalizeDob = (dob) => {
  const value = String(dob || '').trim();
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const ddmmyyyy = value.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
  if (ddmmyyyy) {
    const [, dd, mm, yyyy] = ddmmyyyy;
    return `${yyyy}-${mm}-${dd}`;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
const register = async (req, res) => {
  try {
    const {
      firstName,
      fatherName,
      gotra,
      email,
      password,
      husbandName,
      districtCode,
      phone,
    } = req.body;
    const dob = normalizeDob(req.body.dob || req.body.dateOfBirth || req.body.date_of_birth);
    const gender = normalizeGender(req.body.gender);
    const maritalStatus = normalizeMaritalStatus(
      req.body.maritalStatus ?? req.body.maritialStatus ?? req.body.marital_status
    );

    // Validate input
    if (!firstName || !fatherName || !dob || !gotra || !gender || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields',
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email',
      });
    }

    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters',
      });
    }

    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered',
      });
    }

    // Create user
    const user = await User.create({
      firstName,
      fatherName,
      dob,
      gotra,
      gender,
      maritalStatus,
      husbandName,
      districtCode,
      email,
      password,
      phone,
    });

    // Generate tokens with slug (Phase 1: Slug ID migration)
    const tokens = generateTokens(user.id, user.email, user.slug);

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        user: {
          id: user.id,
          slug: user.slug,
          firstName: user.first_name,
          fatherName: user.father_name,
          dob: user.dob,
          gotra: user.gotra,
          email: user.email,
          role: user.role || 'user',
          gender: user.gender || null,
          maritalStatus: user.marital_status || null,
          husbandName: user.husband_name || null,
          districtCode: user.district_code || '00',
          seerviCardId: user.seervi_card_id || null,
          roleCategoryLabel: buildRoleCategory(user.role, user.occupation),
          assignment_level: user.assignment_level || 'village',
          state: user.state || null,
          district: user.district || null,
          tehsil: user.tehsil || null,
          village: user.village || null,
          profilePhotoUrl: user.profile_photo_url || null,
        },
        tokens,
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Registration failed',
    });
  }
};

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
const login = async (req, res) => {
  try {
    const loginId = String(req.body.identifier || req.body.email || '').trim();
    const { password } = req.body;

    // Validate input
    if (!loginId || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide login identifier and password',
      });
    }

    // Find user
    const user = await User.findByIdentifier(loginId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Check if user is active
    if (!user.is_active) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated',
      });
    }

    // Verify password
    const isPasswordValid = await User.verifyPassword(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Update last login
    await User.updateLastLogin(user.id);

    // Generate tokens with slug (Phase 1: Slug ID migration)
    const tokens = generateTokens(user.id, user.email, user.slug);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          slug: user.slug,
          firstName: user.first_name,
          fatherName: user.father_name,
          dob: user.dob,
          gotra: user.gotra,
          email: user.email,
          role: user.role || 'user',
          gender: user.gender || null,
          maritalStatus: user.marital_status || null,
          husbandName: user.husband_name || null,
          occupation: user.occupation || null,
          districtCode: user.district_code || '00',
          seerviCardId: user.seervi_card_id || null,
          roleCategoryLabel: buildRoleCategory(user.role, user.occupation),
          assignment_level: user.assignment_level || 'village',
          state: user.state || null,
          district: user.district || null,
          tehsil: user.tehsil || null,
          village: user.village || null,
          lastLogin: user.last_login,
          profilePhotoUrl: user.profile_photo_url || null,
        },
        tokens,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed',
    });
  }
};

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token
 * @access  Public
 */
const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required',
      });
    }

    // Verify refresh token
    const decoded = verifyToken(refreshToken);

    if (decoded.type !== 'refresh') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token type',
      });
    }

    // Generate new tokens
    const tokens = generateTokens(decoded.userId, decoded.email);

    res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      data: { tokens },
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid or expired refresh token',
    });
  }
};

/**
 * @route   GET /api/auth/me
 * @desc    Get current user
 * @access  Private
 */
const getMe = async (req, res) => {
  try {
    const user = { ...req.user };

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user.id,
          slug: user.slug,
          firstName: user.first_name,
          fatherName: user.father_name,
          dob: user.dob,
          gotra: user.gotra,
          email: user.email,
          role: user.role || 'user',
          gender: user.gender || null,
          maritalStatus: user.marital_status || null,
          husbandName: user.husband_name || null,
          occupation: user.occupation || null,
          districtCode: user.district_code || '00',
          seerviCardId: user.seervi_card_id || null,
          roleCategoryLabel: buildRoleCategory(user.role, user.occupation),
          assignment_level: user.assignment_level || 'village',
          state: user.state || null,
          district: user.district || null,
          tehsil: user.tehsil || null,
          village: user.village || null,
          lastLogin: user.last_login,
          profilePhotoUrl: user.profile_photo_url || null,
        },
      },
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user data',
    });
  }
};

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user (client-side token removal)
 * @access  Private
 */
const logout = async (req, res) => {
  try {
    // In a stateless JWT system, logout is handled client-side by removing tokens
    // We can optionally blacklist tokens here if needed

    res.status(200).json({
      success: true,
      message: 'Logout successful',
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Logout failed',
    });
  }
};

module.exports = {
  register,
  login,
  refreshToken,
  getMe,
  logout,
};
