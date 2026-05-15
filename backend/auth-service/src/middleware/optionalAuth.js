/**
 * =====================================================================
 * Optional Authentication Middleware
 * Company: emeelan
 * =====================================================================
 * Verifies token if present, but doesn't fail if not
 */

const { verifyToken: verifyJWT } = require('../utils/jwt');
const User = require('../models/User');

const optionalAuth = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];

      try {
        // Verify token
        const decoded = verifyJWT(token);
        
        // Get user
        const user = await User.findById(decoded.userId);
        if (user) {
          req.user = user;
        }
      } catch (tokenError) {
        // Token invalid or expired, continue without user
        console.log('Optional auth: Invalid token, continuing without user');
      }
    }

    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};

module.exports = { optionalAuth };
