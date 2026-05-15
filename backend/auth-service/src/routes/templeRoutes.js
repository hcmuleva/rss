/**
 * =====================================================================
 * Temple Routes (Auth-Service)
 * Company: emeelan
 * =====================================================================
 * 
 * IMPORTANT: This file now only handles user-temple RELATIONSHIPS
 * 
 * MIGRATED TO temple-service (port 4001):
 * - GET /temples (temple CRUD)
 * - GET /temples/:id (temple details)
 * - POST /temples (create temple)
 * - PUT /temples/:id (update temple)
 * - DELETE /temples/:id (delete temple)
 * - GET /geographical-hierarchy
 * - GET /admin-stats
 * - Temple teams/groups management
 * - Temple trustees management
 * 
 * KEPT HERE (user-temple relationships):
 * - GET /temples/:id/members (user-temple relationships)
 * - GET /accessible-temples (user's accessible temples)
 * - POST /temples/assign-user (assign user to temple)
 * - DELETE /temples/:templeId/users/:userId (remove user from temple)
 */

const express = require('express');
const router = express.Router();
const templeController = require('../controllers/templeController');
const { protect } = require('../middleware/auth');
const { isAdmin, isSuperAdmin } = require('../middleware/admin');

// =====================================================================
// USER-TEMPLE RELATIONSHIP ROUTES (Kept in auth-service)
// =====================================================================

// Get all temples WITH their admins (optimized single query)
// Must be BEFORE /:id to avoid route conflicts
router.get('/with-admins', protect, async (req, res) => {
  try {
    const query = `
      SELECT 
        t.*,
        COALESCE(
          json_agg(
            json_build_object(
              'id', ut.id,
              'user_id', ut.user_id,
              'first_name', u.first_name,
              'last_name', u.last_name,
              'email', u.email,
              'role', u.role,
              'temple_role', ut.role
            ) ORDER BY ut.assigned_at DESC
          ) FILTER (WHERE ut.id IS NOT NULL AND ut.role = 'admin' AND ut.is_active = true),
          '[]'::json
        ) as admins
      FROM temples t
      LEFT JOIN user_temples ut ON t.id = ut.temple_id AND ut.role = 'admin' AND ut.is_active = true
      LEFT JOIN users u ON ut.user_id = u.id
      WHERE t.id IS NOT NULL
      GROUP BY t.id
      ORDER BY t.id DESC
    `;

    const pool = require('../config/database');
    const result = await pool.query(query);
    console.log("Result of temple", result.rows);
    res.json({
      success: true,
      data: {
        temples: result.rows,
        count: result.rows.length
      }
    });
  } catch (error) {
    console.error('Error getting temples with admins:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get temples with admins',
      error: error.message
    });
  }
});

// Get all temples (basic list without admins)
router.get('/', protect, async (req, res) => {
  try {
    const pool = require('../config/database');
    const query = 'SELECT * FROM temples ORDER BY id DESC';
    const result = await pool.query(query);
    
    res.json({
      success: true,
      data: {
        temples: result.rows,
        count: result.rows.length
      }
    });
  } catch (error) {
    console.error('Error getting temples:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get temples',
      error: error.message
    });
  }
});

// IMPORTANT: Specific routes MUST come BEFORE /:id wildcard route!
// Get accessible temples for a user (hierarchical access)
router.get('/accessible-temples', protect, templeController.getAccessibleTemples);
router.get('/accessible-temples/:userId', protect, isAdmin, templeController.getAccessibleTemples);

// Get single temple by ID
// MUST come AFTER specific routes to avoid catching them
router.get('/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const pool = require('../config/database');
    const query = 'SELECT * FROM temples WHERE id = $1';
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Temple not found'
      });
    }
    
    res.json({
      success: true,
      data: {
        temple: result.rows[0]
      }
    });
  } catch (error) {
    console.error('Error getting temple:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get temple',
      error: error.message
    });
  }
});

// Get temple members (user-temple relationships)
router.get('/:id/members', protect, templeController.getTempleMembers);

// Assign user to temple (SuperAdmin only)
router.post('/assign-user', protect, isSuperAdmin, templeController.assignUserToTemple);

// Remove user from temple (SuperAdmin only)
router.delete('/:templeId/users/:userId', protect, isSuperAdmin, templeController.removeUserFromTemple);

// =====================================================================
// COMMENTED OUT - MIGRATED TO temple-service
// =====================================================================
/*
// Temple CRUD - NOW IN temple-service
// router.get('/temples', templeController.getAllTemples);
// router.get('/temples/:identifier', templeController.getTemple);
// router.post('/temples', protect, isAdmin, templeController.createTemple);
// router.put('/temples/:id', protect, isAdmin, templeController.updateTemple);
// router.delete('/temples/:id', protect, isSuperAdmin, templeController.deleteTemple);

// Geographical hierarchy - NOW IN temple-service
// router.get('/geographical-hierarchy', protect, templeController.getGeographicalHierarchy);
// router.get('/admin-stats', protect, isSuperAdmin, templeController.getAdminStats);
*/

module.exports = router;
