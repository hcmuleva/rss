/**
 * =====================================================================
 * RBAC Level Access Middleware
 * Company: emeelan
 * =====================================================================
 */

const LEVELS = ['prant', 'jila', 'tehsil', 'village'];

/**
 * Validates if the requester has authority over the target level and location
 * This is used for creating users, assigning roles, and creating temples.
 */
const checkLevelAccess = (req, res, next) => {
  try {
    const user = req.user;

    // SuperAdmin has global access
    if (user.role === 'superadmin') return next();

    // If not admin, they shouldn't be here (isAdmin middleware should have caught it, but double check)
    if (user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Hierarchical admin privileges required.',
      });
    }

    const { 
      assignment_level: adminLevel, 
      state: adminState, 
      district: adminDistrict, 
      tehsil: adminTehsil, 
      village: adminVillage 
    } = user;

    // Target data can be in body (creation/update) or query (filtering)
    const target = req.method === 'GET' ? req.query : req.body;
    
    // If no target level is specified, we might be doing a general list (handled by filtering)
    if (!target.assignmentLevel && !target.level) return next();

    const targetLevel = (target.assignmentLevel || target.level).toLowerCase();
    
    // 1. Check Level Hierarchy
    const adminLevelIndex = LEVELS.indexOf(adminLevel);
    const targetLevelIndex = LEVELS.indexOf(targetLevel);

    if (adminLevelIndex === -1 || targetLevelIndex === -1) {
      return res.status(400).json({ success: false, message: 'Invalid assignment level' });
    }

    if (targetLevelIndex < adminLevelIndex) {
      return res.status(403).json({
        success: false,
        message: `Your level (${adminLevel}) does not have authority over ${targetLevel} level.`,
      });
    }

    // 2. Check Geographic Scope
    // Admin must match State
    if (adminState && target.state && adminState.toLowerCase() !== target.state.toLowerCase()) {
      return res.status(403).json({ success: false, message: `Access denied. You only have authority over ${adminState}.` });
    }

    // If Admin is Jila or below, must match District
    if (adminLevelIndex >= 1) { // jila, tehsil, village
      const targetDistrict = target.district || target.jila;
      if (adminDistrict && targetDistrict && adminDistrict.toLowerCase() !== targetDistrict.toLowerCase()) {
        return res.status(403).json({ success: false, message: `Access denied. You only have authority over ${adminDistrict} district.` });
      }
    }

    // If Admin is Tehsil or below, must match Tehsil
    if (adminLevelIndex >= 2) { // tehsil, village
      if (adminTehsil && target.tehsil && adminTehsil.toLowerCase() !== target.tehsil.toLowerCase()) {
        return res.status(403).json({ success: false, message: `Access denied. You only have authority over ${adminTehsil} tehsil.` });
      }
    }

    // If Admin is Village, must match Village
    if (adminLevelIndex === 3) { // village
      if (adminVillage && target.village && adminVillage.toLowerCase() !== target.village.toLowerCase()) {
        return res.status(403).json({ success: false, message: `Access denied. You only have authority over ${adminVillage} village.` });
      }
    }

    next();
  } catch (error) {
    console.error('RBAC Level Access Error:', error);
    res.status(500).json({ success: false, message: 'Internal server error in RBAC validation' });
  }
};

/**
 * Injects location filters into the query based on admin's jurisdiction
 */
const injectJurisdictionFilters = (req, res, next) => {
  const user = req.user;
  if (user.role === 'superadmin') return next();

  if (user.role === 'admin') {
    const { 
      assignment_level: adminLevel, 
      state: adminState, 
      district: adminDistrict, 
      tehsil: adminTehsil, 
      village: adminVillage 
    } = user;

    // Apply filters based on admin level
    if (adminLevel === 'prant') {
      req.query.state = adminState;
    } else if (adminLevel === 'jila') {
      req.query.state = adminState;
      req.query.district = adminDistrict;
    } else if (adminLevel === 'tehsil') {
      req.query.state = adminState;
      req.query.district = adminDistrict;
      req.query.tehsil = adminTehsil;
    } else if (adminLevel === 'village') {
      req.query.state = adminState;
      req.query.district = adminDistrict;
      req.query.tehsil = adminTehsil;
      req.query.village = adminVillage;
    }
  }

  next();
};

module.exports = { checkLevelAccess, injectJurisdictionFilters };
