/**
 * =====================================================================
 * Admin Middleware
 * Company: emeelan
 * =====================================================================
 */

/**
 * Check if user is admin or superadmin
 */
const isAdmin = (req, res, next) => {
  try {
    const user = req.user;

    if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.',
      });
    }

    next();
  } catch (error) {
    console.error('Admin middleware error:', error);
    return res.status(403).json({
      success: false,
      message: 'Access denied',
    });
  }
};

/**
 * Check if user is superadmin
 */
const isSuperAdmin = (req, res, next) => {
  try {
    const user = req.user;

    if (!user || user.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. SuperAdmin privileges required.',
      });
    }

    next();
  } catch (error) {
    console.error('SuperAdmin middleware error:', error);
    return res.status(403).json({
      success: false,
      message: 'Access denied',
    });
  }
};

module.exports = { isAdmin, isSuperAdmin };
