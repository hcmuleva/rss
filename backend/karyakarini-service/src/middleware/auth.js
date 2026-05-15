const axios = require('axios');

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:4000';

const normalizeRole = (role) =>
  String(role || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, '');

const getRole = (user) =>
  normalizeRole(user?.role || user?.userRole || user?.user?.role || user?.data?.role);

const isAdminRole = (role) => ['admin', 'superadmin', 'templeadmin'].includes(normalizeRole(role));

const verifyToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided',
      });
    }

    const response = await axios.get(`${AUTH_SERVICE_URL}/api/auth/verify`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response?.data?.success) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token',
      });
    }

    req.user = response.data.user || response.data.data?.user || response.data.data || null;
    req.userRole = getRole(req.user);
    return next();
  } catch (error) {
    console.error('Auth verification failed:', error?.message || error);
    return res.status(401).json({
      success: false,
      message: 'Authentication failed',
    });
  }
};

const requireAdmin = (req, res, next) => {
  if (!isAdminRole(req.userRole)) {
    return res.status(403).json({
      success: false,
      message: 'Admin access required',
    });
  }
  return next();
};

const requireSuperAdmin = (req, res, next) => {
  if (req.userRole !== 'superadmin') {
    return res.status(403).json({
      success: false,
      message: 'SuperAdmin access required',
    });
  }
  return next();
};

module.exports = {
  verifyToken,
  requireAdmin,
  requireSuperAdmin,
  isAdminRole,
  normalizeRole,
};
