/**
 * =====================================================================
 * Temple Context Middleware
 * Company: emeelan
 * =====================================================================
 * Handles temple context for superadmin operations
 */

const UserTemple = require('../models/UserTemple');

/**
 * Extract temple context from request
 * Can be from:
 * - Header: X-Temple-Context
 * - Query: ?temple_id=123
 * - Body: { temple_id: 123 }
 */
exports.withTempleContext = async (req, res, next) => {
  try {
    let templeId = null;

    // Try to get temple context from various sources
    if (req.headers['x-temple-context']) {
      templeId = parseInt(req.headers['x-temple-context']);
    } else if (req.query.temple_id) {
      templeId = parseInt(req.query.temple_id);
    } else if (req.body.temple_id) {
      templeId = parseInt(req.body.temple_id);
    }

    // If temple context is provided, validate user belongs to temple
    if (templeId) {
      // SuperAdmin can access any temple
      if (req.user.role === 'superadmin') {
        req.templeContext = templeId;
        return next();
      }

      // Check if user belongs to this temple
      const belongsToTemple = await UserTemple.userBelongsToTemple(req.user.id, templeId);
      
      if (!belongsToTemple) {
        return res.status(403).json({
          success: false,
          message: 'You do not have access to this temple'
        });
      }

      req.templeContext = templeId;
      req.templeRole = await UserTemple.getUserTempleRole(req.user.id, templeId);
    }

    next();
  } catch (error) {
    console.error('Temple context middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to validate temple context'
    });
  }
};

/**
 * Require temple context
 */
exports.requireTempleContext = (req, res, next) => {
  if (!req.templeContext) {
    return res.status(400).json({
      success: false,
      message: 'Temple context is required. Provide temple_id in header, query, or body'
    });
  }
  next();
};
