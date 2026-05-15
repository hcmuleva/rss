/**
 * =====================================================================
 * Admin Activities Controller
 * Company: emeelan
 * =====================================================================
 * Detailed admin activity tracking for superadmin
 */

const pool = require('../config/database');

/**
 * Get detailed activities for a user
 * GET /api/admin/activities/:userId
 */
exports.getUserActivities = async (req, res) => {
  try {
    const { userId } = req.params;

    // Only superadmin can view activities
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Only superadmin can view detailed activities'
      });
    }

    // Get user info
    const userQuery = `
      SELECT id, first_name, last_name, email, role, created_at
      FROM users WHERE id = $1
    `;
    const userResult = await pool.query(userQuery, [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = userResult.rows[0];

    // Get temples created
    const templesQuery = `
      SELECT 
        id, name, name_hi, state, district, village,
        created_at, is_active
      FROM temples
      WHERE created_by = $1
      ORDER BY created_at DESC
    `;
    const templesResult = await pool.query(templesQuery, [userId]);

    // Get families created
    const familiesQuery = `
      SELECT 
        f.id, f.name, f.gotra, f.village, f.district, f.state,
        f.created_at, t.name as temple_name
      FROM families f
      LEFT JOIN temples t ON f.temple_id = t.id
      WHERE f.created_by = $1
      ORDER BY f.created_at DESC
    `;
    const familiesResult = await pool.query(familiesQuery, [userId]);

    // Get members added (from families created by user)
    const membersQuery = `
      SELECT 
        fm.id, 
        COALESCE(
          TRIM(CONCAT(u.first_name, ' ', COALESCE(u.last_name, ''))),
          'N/A'
        ) as name,
        COALESCE(fm.relation_to_head, fm.relationship_to_head, 'N/A') as relation,
        COALESCE(u.marital_status, 'N/A') as marital_status,
        fm.joined_at as created_at,
        f.name as family_name, 
        t.name as temple_name
      FROM family_members fm
      INNER JOIN families f ON fm.family_id = f.id
      LEFT JOIN temples t ON f.temple_id = t.id
      LEFT JOIN users u ON fm.user_id = u.id
      WHERE f.created_by = $1
      ORDER BY fm.joined_at DESC
      LIMIT 500
    `;
    const membersResult = await pool.query(membersQuery, [userId]);

    // Get teams/groups created
    const teamsQuery = `
      SELECT 
        tg.id, tg.name, tg.group_type, tg.description,
        tg.created_at, t.name as temple_name
      FROM temple_groups tg
      LEFT JOIN temples t ON tg.temple_id = t.id
      WHERE tg.created_by = $1
      ORDER BY tg.created_at DESC
    `;
    const teamsResult = await pool.query(teamsQuery, [userId]);

    // Get events created
    const eventsQuery = `
      SELECT 
        e.id, e.title, e.category, e.event_date, e.end_date,
        e.location, e.status, e.created_at, t.name as temple_name
      FROM events e
      LEFT JOIN temples t ON e.temple_id = t.id
      WHERE e.created_by = $1
      ORDER BY e.created_at DESC
    `;
    const eventsResult = await pool.query(eventsQuery, [userId]);

    // Get trustees assigned
    const trusteesQuery = `
      SELECT 
        tr.id, tr.name, tr.designation, tr.phone, tr.email,
        tr.amount, tr.contribution_date, tr.created_at, 
        t.name as temple_name
      FROM temple_trustees tr
      LEFT JOIN temples t ON tr.temple_id = t.id
      WHERE tr.created_by = $1
      ORDER BY tr.created_at DESC
    `;
    const trusteesResult = await pool.query(trusteesQuery, [userId]);

    // Get admins assigned
    const adminsQuery = `
      SELECT 
        ut.id, ut.admin_level, ut.assigned_at,
        u.first_name, u.last_name, u.email, u.role,
        t.name as temple_name
      FROM user_temples ut
      INNER JOIN users u ON ut.user_id = u.id
      LEFT JOIN temples t ON ut.temple_id = t.id
      WHERE ut.created_by = $1 AND ut.is_active = true
      ORDER BY ut.assigned_at DESC
    `;
    const adminsResult = await pool.query(adminsQuery, [userId]);

    // Calculate summary stats
    const summary = {
      total_temples: templesResult.rows.length,
      total_families: familiesResult.rows.length,
      total_members: membersResult.rows.length,
      total_teams: teamsResult.rows.length,
      total_events: eventsResult.rows.length,
      total_trustees: trusteesResult.rows.length,
      total_admins: adminsResult.rows.length,
      total_points: 
        templesResult.rows.length * 100 +
        familiesResult.rows.length * 10 +
        membersResult.rows.length * 2 +
        teamsResult.rows.length * 20 +
        eventsResult.rows.length * 15 +
        trusteesResult.rows.length * 5 +
        adminsResult.rows.length * 8
    };

    // Get activity timeline (recent activities across all types)
    const timelineQuery = `
      SELECT * FROM (
        SELECT 'temple' as type, id, name as title, created_at FROM temples WHERE created_by = $1
        UNION ALL
        SELECT 'family' as type, id, name as title, created_at FROM families WHERE created_by = $1
        UNION ALL
        SELECT 'team' as type, id, name as title, created_at FROM temple_groups WHERE created_by = $1
        UNION ALL
        SELECT 'event' as type, id, title, created_at FROM events WHERE created_by = $1
      ) activities
      ORDER BY created_at DESC
      LIMIT 50
    `;
    const timelineResult = await pool.query(timelineQuery, [userId]);

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: `${user.first_name} ${user.last_name || ''}`.trim(),
          email: user.email,
          role: user.role,
          joined: user.created_at
        },
        summary,
        activities: {
          temples: templesResult.rows,
          families: familiesResult.rows,
          members: membersResult.rows,
          teams: teamsResult.rows,
          events: eventsResult.rows,
          trustees: trusteesResult.rows,
          admins: adminsResult.rows
        },
        timeline: timelineResult.rows
      }
    });
  } catch (error) {
    console.error('Get user activities error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user activities',
      error: error.message
    });
  }
};

module.exports = exports;
