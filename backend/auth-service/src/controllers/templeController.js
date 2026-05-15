/**
 * =====================================================================
 * Temple Controller
 * Company: emeelan
 * =====================================================================
 */

const Temple = require('../models/Temple');
const UserTemple = require('../models/UserTemple');

// Get all temples
exports.getAllTemples = async (req, res) => {
  try {
    const { is_active, location, search, limit, offset } = req.query;
    
    const temples = await Temple.findAll({
      is_active: is_active === 'false' ? false : true,
      location,
      search,
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0
    });

    res.json({
      success: true,
      data: {
        temples,
        total: temples.length
      }
    });
  } catch (error) {
    console.error('Get all temples error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch temples'
    });
  }
};

// Get temple by ID or slug
exports.getTemple = async (req, res) => {
  try {
    const { identifier } = req.params;
    
    let temple;
    if (isNaN(identifier)) {
      temple = await Temple.findBySlug(identifier);
    } else {
      temple = await Temple.findById(identifier);
    }

    if (!temple) {
      return res.status(404).json({
        success: false,
        message: 'Temple not found'
      });
    }

    // Get members
    const members = await Temple.getMembers(temple.id);

    res.json({
      success: true,
      data: {
        temple: {
          ...temple,
          members
        }
      }
    });
  } catch (error) {
    console.error('Get temple error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch temple'
    });
  }
};

// Create temple (Admin only)
exports.createTemple = async (req, res) => {
  try {
    const {
      name,
      name_hi,
      location,
      city,
      state,
      district,
      tehsil,
      village,
      pincode,
      landmark,
      contact_email,
      contact_phone,
      photo_url,
      latitude,
      longitude,
      description,
      description_hi
    } = req.body;

    // Validation
    if (!name || !location) {
      return res.status(400).json({
        success: false,
        message: 'Name and location are required'
      });
    }

    const temple = await Temple.create({
      name,
      name_hi,
      location,
      city,
      state,
      district,
      tehsil,
      village,
      pincode,
      landmark,
      contact_email,
      contact_phone,
      photo_url,
      latitude,
      longitude,
      description,
      description_hi,
      created_by: req.user.id
    });

    res.status(201).json({
      success: true,
      message: 'Temple created successfully',
      data: { temple }
    });
  } catch (error) {
    console.error('Create temple error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create temple'
    });
  }
};

// Update temple (Admin who created it or SuperAdmin)
exports.updateTemple = async (req, res) => {
  try {
    const { id } = req.params;
    const temple = await Temple.findById(id);

    if (!temple) {
      return res.status(404).json({
        success: false,
        message: 'Temple not found'
      });
    }

    // Check permissions
    if (req.user.role !== 'superadmin' && temple.created_by !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You can only update temples you created'
      });
    }

    const updatedTemple = await Temple.update(id, req.body);

    res.json({
      success: true,
      message: 'Temple updated successfully',
      data: { temple: updatedTemple }
    });
  } catch (error) {
    console.error('Update temple error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update temple'
    });
  }
};

// Delete temple (soft delete) - SuperAdmin only
exports.deleteTemple = async (req, res) => {
  try {
    const { id } = req.params;
    const temple = await Temple.delete(id);

    if (!temple) {
      return res.status(404).json({
        success: false,
        message: 'Temple not found'
      });
    }

    res.json({
      success: true,
      message: 'Temple deactivated successfully',
      data: { temple }
    });
  } catch (error) {
    console.error('Delete temple error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete temple'
    });
  }
};

// Get user's temples
exports.getUserTemples = async (req, res) => {
  try {
    const userId = req.params.userId || req.user.id;
    
    const temples = await Temple.getUserTemples(userId);

    res.json({
      success: true,
      data: { temples }
    });
  } catch (error) {
    console.error('Get user temples error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user temples'
    });
  }
};

// Assign user to temple (SuperAdmin only)
exports.assignUserToTemple = async (req, res) => {
  try {
    const { templeId, userId, role, adminLevel } = req.body;

    if (!templeId || !userId) {
      return res.status(400).json({
        success: false,
        message: 'Temple ID and User ID are required'
      });
    }

    // Validate admin level
    const validLevels = ['temple', 'village', 'tehsil', 'district'];
    if (adminLevel && !validLevels.includes(adminLevel)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid admin level. Valid values: temple, village, tehsil, district'
      });
    }

    const temple = await Temple.findById(templeId);
    if (!temple) {
      return res.status(404).json({
        success: false,
        message: 'Temple not found'
      });
    }

    const assignment = await Temple.assignUser(
      templeId,
      userId,
      req.user.id,
      role || 'member',
      adminLevel || 'temple'
    );

    // Send real-time notification via Ably
    try {
      const ablyService = require('../services/ablyService');
      await ablyService.publishToUser(userId, 'temple-assignment', {
        type: 'temple-assigned',
        templeId: templeId,
        templeName: temple.name,
        role: role || 'member',
        adminLevel: adminLevel || 'temple',
        timestamp: new Date().toISOString()
      });
      console.log(`✅ Ably notification sent to user ${userId} for temple assignment`);
    } catch (ablyError) {
      console.error('❌ Ably notification failed:', ablyError);
      // Don't fail the request if Ably fails
    }

    res.json({
      success: true,
      message: 'User assigned to temple successfully',
      data: { 
        assignment,
        hierarchyInfo: {
          level: assignment.admin_level,
          district: temple.district,
          tehsil: temple.tehsil,
          village: temple.village
        }
      }
    });
  } catch (error) {
    console.error('Assign user to temple error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign user to temple'
    });
  }
};

// Remove user from temple (SuperAdmin only)
exports.removeUserFromTemple = async (req, res) => {
  try {
    const { templeId, userId } = req.params;

    const result = await Temple.removeUser(templeId, userId);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Assignment not found'
      });
    }

    res.json({
      success: true,
      message: 'User removed from temple successfully'
    });
  } catch (error) {
    console.error('Remove user from temple error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove user from temple'
    });
  }
};

// Get temple members
exports.getTempleMembers = async (req, res) => {
  try {
    const { id } = req.params;
    
    const members = await Temple.getMembers(id);

    res.json({
      success: true,
      data: { members }
    });
  } catch (error) {
    console.error('Get temple members error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch temple members'
    });
  }
};

// Get accessible temples based on hierarchical level
exports.getAccessibleTemples = async (req, res) => {
  try {
    const userId = req.params.userId || req.user.id;
    
    const temples = await Temple.getAccessibleTemples(userId);

    res.json({
      success: true,
      data: { temples }
    });
  } catch (error) {
    console.error('Get accessible temples error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch accessible temples'
    });
  }
};

// Get admin statistics by geographical levels
exports.getAdminStats = async (req, res) => {
  try {
    const stats = await Temple.getAdminStats();

    res.json({
      success: true,
      data: { stats }
    });
  } catch (error) {
    console.error('Get admin stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch admin statistics'
    });
  }
};

// Get geographical hierarchy
exports.getGeographicalHierarchy = async (req, res) => {
  try {
    const { district, tehsil, village } = req.query;
    
    const hierarchy = await Temple.getGeographicalHierarchy(district, tehsil, village);

    res.json({
      success: true,
      data: { hierarchy }
    });
  } catch (error) {
    console.error('Get geographical hierarchy error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch geographical hierarchy'
    });
  }
};
