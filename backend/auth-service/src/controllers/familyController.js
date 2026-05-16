/**
 * =====================================================================
 * Family Controller
 * Company: emeelan
 * =====================================================================
 */

const Family = require('../models/Family');

// Get families (with temple filter support and pagination)
exports.getFamilies = async (req, res) => {
  try {
    const { temple_id, limit, offset, search, gotra } = req.query;
    const pool = require('../config/database');

    if (!temple_id) {
      return res.json({ success: true, families: [], data: { families: [], totalCount: 0 } });
    }

    let queryText = `
      SELECT 
        f.id,
        f.slug,
        f.name,
        f.head_of_family_name,
        f.gotra,
        f.village,
        f.ancestral_village,
        f.tehsil,
        f.district,
        f.state,
        f.phone,
        f.email,
        f.temple_id,
        f.active as active,
        f.updated_at,
        (SELECT COUNT(*) FROM family_members WHERE family_id = f.id AND active = true) as total_members,
        COUNT(*) OVER() as full_count
      FROM families f
      WHERE f.active = true
    `;
    
    const queryParams = [];
    let paramIndex = 1;

    if (temple_id === 'unassigned') {
      queryText += ` AND f.temple_id IS NULL AND NOT EXISTS (SELECT 1 FROM family_temples WHERE family_id = f.id)`;
    } else {
      queryText += ` AND (
        f.temple_id = $${paramIndex} 
        OR EXISTS (SELECT 1 FROM family_temples WHERE family_id = f.id AND temple_id = $${paramIndex})
      )`;
      queryParams.push(parseInt(temple_id));
      paramIndex++;
    }

    if (search) {
      queryText += ` AND (f.name ILIKE $${paramIndex} OR f.head_of_family_name ILIKE $${paramIndex} OR f.gotra ILIKE $${paramIndex})`;
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    if (gotra && gotra !== 'all') {
      queryText += ` AND f.gotra = $${paramIndex}`;
      queryParams.push(gotra);
      paramIndex++;
    }

    queryText += ` ORDER BY f.updated_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(parseInt(limit) || 10, parseInt(offset) || 0);

    const result = await pool.query(queryText, queryParams);

    const totalCount = result.rows.length > 0 ? parseInt(result.rows[0].full_count) : 0;

    res.json({
      success: true,
      families: result.rows,
      data: { 
        families: result.rows,
        totalCount: totalCount
      }
    });
  } catch (error) {
    console.error('Get families error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch families'
    });
  }
};

// Get family by ID or slug
exports.getFamily = async (req, res) => {
  try {
    const { identifier } = req.params;
    
    const pool = require('../config/database');
    let result;
    
    const isNumeric = /^\d+$/.test(identifier);
    
    if (!isNumeric) {
      // Search by slug
      result = await pool.query(`
        SELECT 
          f.*,
          f.active as active,
          t.name as temple_name,
          (SELECT COUNT(*) FROM family_members WHERE family_id = f.id) as total_members
        FROM families f
        LEFT JOIN temples t ON f.temple_id = t.id
        WHERE f.slug = $1 AND f.active = true
      `, [identifier]);
    } else {
      // Search by ID
      result = await pool.query(`
        SELECT 
          f.*,
          f.active as active,
          t.name as temple_name,
          (SELECT COUNT(*) FROM family_members WHERE family_id = f.id) as total_members
        FROM families f
        LEFT JOIN temples t ON f.temple_id = t.id
        WHERE f.id = $1 AND f.active = true
      `, [identifier]);
    }

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Family not found'
      });
    }

    const family = result.rows[0];

    res.json({
      success: true,
      family: family,
      data: {
        family: family
      }
    });
  } catch (error) {
    console.error('Get family error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch family'
    });
  }
};

// Create family (requires temple context)
exports.createFamily = async (req, res) => {
  try {
    const {
      name,
      name_hi,
      temple_id,
      gotra,
      ancestral_village,
      village,
      tehsil,
      district,
      state,
      country,
      pincode,
      latitude,
      longitude,
      description,
      description_hi,
      created_by
    } = req.body;

    // Validation
    if (!name || !temple_id) {
      return res.status(400).json({
        success: false,
        message: 'Name and temple are required'
      });
    }

    const family = await Family.create({
      name,
      name_hi,
      temple_id,
      gotra,
      ancestral_village,
      village,
      tehsil,
      district,
      state,
      country,
      pincode,
      latitude,
      longitude,
      description,
      description_hi,
      created_by: req.user.id
    });

    res.status(201).json({
      success: true,
      message: 'Family created successfully',
      data: {
        family,
        created_by: {
          id: req.user.id,
          role: req.user.role
        }
      }
    });
  } catch (error) {
    console.error('Create family error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create family'
    });
  }
};

// Update family
exports.updateFamily = async (req, res) => {
  try {
    const { id } = req.params;
    const family = await Family.findById(id);

    if (!family) {
      return res.status(404).json({
        success: false,
        message: 'Family not found'
      });
    }

    // Check permissions (creator or superadmin can update)
    if (req.user.role !== 'superadmin' && family.created_by !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You can only update families you created'
      });
    }

    const updatedFamily = await Family.update(id, req.body);

    res.json({
      success: true,
      message: 'Family updated successfully',
      data: { family: updatedFamily }
    });
  } catch (error) {
    console.error('Update family error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update family'
    });
  }
};

// Add member to family
exports.addFamilyMember = async (req, res) => {
  try {
    const { familyId } = req.params;
    const { userId, relationToHead, isHead } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    const member = await Family.addMember(
      familyId,
      userId,
      relationToHead,
      isHead || false
    );

    res.json({
      success: true,
      message: 'Member added to family successfully',
      data: { member }
    });
  } catch (error) {
    console.error('Add family member error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add member to family'
    });
  }
};

// Get family members
exports.getFamilyMembers = async (req, res) => {
  try {
    const { id } = req.params;
    
    const members = await Family.getMembers(id);

    res.json({
      success: true,
      data: { members }
    });
  } catch (error) {
    console.error('Get family members error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch family members'
    });
  }
};

// Get family heads (supports multiple heads)
exports.getFamilyHeads = async (req, res) => {
  try {
    const { id } = req.params;
    const heads = await Family.getHeads(id);

    res.json({
      success: true,
      data: { heads }
    });
  } catch (error) {
    console.error('Get family heads error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch family heads'
    });
  }
};

// Replace family heads (multi-head API)
exports.updateFamilyHeads = async (req, res) => {
  try {
    const { id } = req.params;
    const { familyMemberIds, primaryFamilyMemberId } = req.body || {};

    const heads = await Family.setHeads(id, familyMemberIds, primaryFamilyMemberId);

    res.json({
      success: true,
      message: 'Family heads updated successfully',
      data: { heads }
    });
  } catch (error) {
    console.error('Update family heads error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to update family heads'
    });
  }
};

// Backward-compatible single-head API
exports.updateSingleFamilyHead = async (req, res) => {
  try {
    const { id } = req.params;
    const { familyMemberId } = req.body || {};
    const parsedId = Number(familyMemberId);

    if (!parsedId || Number.isNaN(parsedId)) {
      return res.status(400).json({
        success: false,
        message: 'familyMemberId is required'
      });
    }

    const heads = await Family.setHeads(id, [parsedId], parsedId);
    res.json({
      success: true,
      message: 'Family head updated successfully',
      data: { heads }
    });
  } catch (error) {
    console.error('Update single family head error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to update family head'
    });
  }
};

// Add temple to family
exports.addTempleToFamily = async (req, res) => {
  try {
    const { familyId } = req.params;
    const { templeId, isPrimary } = req.body;

    if (!templeId) {
      return res.status(400).json({
        success: false,
        message: 'Temple ID is required'
      });
    }

    const association = await Family.addTemple(
      familyId,
      templeId,
      isPrimary || false
    );

    res.json({
      success: true,
      message: 'Temple added to family successfully',
      data: { association }
    });
  } catch (error) {
    console.error('Add temple to family error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add temple to family'
    });
  }
};

// Remove temple from family
exports.removeTempleFromFamily = async (req, res) => {
  try {
    const { familyId, templeId } = req.params;

    const result = await Family.removeTemple(familyId, templeId);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Association not found'
      });
    }

    res.json({
      success: true,
      message: 'Temple removed from family successfully'
    });
  } catch (error) {
    console.error('Remove temple from family error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove temple from family'
    });
  }
};

// Search families by name, gotra, village, or phone
exports.searchFamilies = async (req, res) => {
  try {
    const { query, field } = req.query;
    console.log('Search request:', { query, field });

    if (!query || query.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters'
      });
    }

    const pool = require('../config/database');
    const searchPattern = `%${query}%`;

    let result;

    if (field === 'phone') {
      // Search specifically by phone number
      console.log('Phone search:', { query, searchPattern, field });
      result = await pool.query(`
        SELECT 
          f.id,
          f.slug,
          f.name,
          f.head_of_family_name,
          f.gotra,
          f.village,
          f.ancestral_village,
          f.tehsil,
          f.district,
          f.state,
          f.phone,
          f.email,
          f.temple_id,
          f.active as active,
          COALESCE(t.name, (SELECT name FROM temples WHERE id = (SELECT temple_id FROM family_temples WHERE family_id = f.id LIMIT 1))) as temple_name,
          (SELECT COUNT(*) FROM family_members WHERE family_id = f.id) as total_members
        FROM families f
        LEFT JOIN temples t ON f.temple_id = t.id
        WHERE 
          f.active = true
          AND f.phone LIKE $1
        ORDER BY f.name
        LIMIT 50
      `, [searchPattern]);
    } else {
      // Search by name, gotra, village
      result = await pool.query(`
        SELECT 
          f.id,
          f.slug,
          f.name,
          f.head_of_family_name,
          f.gotra,
          f.village,
          f.ancestral_village,
          f.tehsil,
          f.district,
          f.state,
          f.phone,
          f.email,
          f.temple_id,
          f.active as active,
          COALESCE(t.name, (SELECT name FROM temples WHERE id = (SELECT temple_id FROM family_temples WHERE family_id = f.id LIMIT 1))) as temple_name,
          (SELECT COUNT(*) FROM family_members WHERE family_id = f.id) as total_members
        FROM families f
        LEFT JOIN temples t ON f.temple_id = t.id
        WHERE 
          f.active = true
          AND (
            f.name ILIKE $1 
            OR f.head_of_family_name ILIKE $1
            OR f.gotra ILIKE $1
            OR f.village ILIKE $1
            OR f.ancestral_village ILIKE $1
          )
        ORDER BY f.name
        LIMIT 50
      `, [searchPattern]);
    }

    res.json({
      success: true,
      families: result.rows
    });
  } catch (error) {
    console.error('Search families error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search families'
    });
  }
};

// Assign family to temple
exports.assignTemple = async (req, res) => {
  try {
    const { id } = req.params;
    const { temple_id } = req.body;

    if (!temple_id) {
      return res.status(400).json({
        success: false,
        message: 'temple_id is required'
      });
    }

    // 1. Update legacy column
    const pool = require('../config/database');
    await pool.query(`
      UPDATE families 
      SET 
        temple_id = $1,
        updated_at = NOW()
      WHERE id = $2 AND active = true
    `, [temple_id, id]);

    // 2. Add to junction table for multi-temple support
    const Family = require('../models/Family');
    const association = await Family.addTemple(id, temple_id, true);

    res.json({
      success: true,
      message: 'Family assigned to temple successfully',
      family: { id, temple_id },
      association
    });
  } catch (error) {
    console.error('Assign temple error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign family to temple'
    });
  }
};

// Unassign family from temple
exports.unassignTemple = async (req, res) => {
  try {
    const { id } = req.params;
    const { temple_id } = req.body; // Optional: specify which temple to remove

    const pool = require('../config/database');
    const Family = require('../models/Family');

    if (temple_id) {
      // Remove specific temple from junction table
      await Family.removeTemple(id, temple_id);
      
      // If it was the legacy temple_id, clear it
      await pool.query(`
        UPDATE families 
        SET temple_id = NULL 
        WHERE id = $1 AND temple_id = $2
      `, [id, temple_id]);
    } else {
      // Legacy behavior: remove current primary temple
      const familyResult = await pool.query('SELECT temple_id FROM families WHERE id = $1', [id]);
      const currentTempleId = familyResult.rows[0]?.temple_id;
      
      if (currentTempleId) {
        await Family.removeTemple(id, currentTempleId);
      }

      await pool.query(`
        UPDATE families 
        SET 
          temple_id = NULL,
          updated_at = NOW()
        WHERE id = $1 AND active = true
      `, [id]);
    }

    res.json({
      success: true,
      message: 'Family removed from temple successfully'
    });
  } catch (error) {
    console.error('Unassign temple error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove family from temple'
    });
  }
};
