/**
 * =====================================================================
 * Contributions Controller
 * Company: emeelan
 * =====================================================================
 * Tracks admin contributions and provides rewards/leaderboard
 */

const pool = require('../config/database');

/**
 * Calculate tier based on points
 */
const calculateTier = (points) => {
  if (points >= 1001) return 'platinum';
  if (points >= 501) return 'gold';
  if (points >= 101) return 'silver';
  return 'bronze';
};

/**
 * Get user contributions
 * GET /api/admin/contributions/:userId
 * GET /api/admin/contributions/me
 */
exports.getUserContributions = async (req, res) => {
  try {
    const userId = req.params.userId === 'me' ? req.user.id : parseInt(req.params.userId);

    // Only allow users to see their own stats unless they're superadmin
    if (userId !== req.user.id && req.user.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        message: 'You can only view your own contributions'
      });
    }

    const query = `
      SELECT 
        u.id as user_id,
        u.first_name,
        u.last_name,
        u.email,
        u.role,
        COUNT(DISTINCT t.id) FILTER (WHERE t.created_by = u.id) as temples_created,
        COUNT(DISTINCT f.id) FILTER (WHERE f.created_by = u.id) as families_created,
        COUNT(DISTINCT fm.id) FILTER (WHERE fm.created_by = u.id) as members_added,
        COUNT(DISTINCT te.id) FILTER (WHERE te.created_by = u.id) as teams_created,
        COUNT(DISTINCT ev.id) FILTER (WHERE ev.created_by = u.id) as events_created,
        COUNT(DISTINCT tr.id) FILTER (WHERE tr.created_by = u.id) as trustees_assigned,
        COUNT(DISTINCT ut2.id) FILTER (WHERE ut2.created_by = u.id) as admins_assigned,
        (
          COUNT(DISTINCT t.id) FILTER (WHERE t.created_by = u.id) * 100 +
          COUNT(DISTINCT f.id) FILTER (WHERE f.created_by = u.id) * 10 +
          COUNT(DISTINCT fm.id) FILTER (WHERE fm.created_by = u.id) * 2 +
          COUNT(DISTINCT te.id) FILTER (WHERE te.created_by = u.id) * 20 +
          COUNT(DISTINCT ev.id) FILTER (WHERE ev.created_by = u.id) * 15 +
          COUNT(DISTINCT tr.id) FILTER (WHERE tr.created_by = u.id) * 5 +
          COUNT(DISTINCT ut.id) FILTER (WHERE ut.created_by = u.id) * 8
        ) as total_points
      FROM users u
      LEFT JOIN temples t ON t.created_by = u.id
      LEFT JOIN families f ON f.created_by = u.id
      LEFT JOIN family_members fm ON fm.family_id IN (SELECT id FROM families WHERE created_by = u.id)
      LEFT JOIN temple_groups te ON te.created_by = u.id
      LEFT JOIN events ev ON ev.created_by = u.id
      LEFT JOIN temple_trustees tr ON tr.created_by = u.id
      LEFT JOIN user_temples ut2 ON ut2.created_by = u.id AND ut2.is_active = true
      WHERE u.id = $1
      GROUP BY u.id, u.first_name, u.last_name, u.email, u.role
    `;

    const result = await pool.query(query, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const data = result.rows[0];
    const totalPoints = parseInt(data.total_points) || 0;
    const tier = calculateTier(totalPoints);

    // Get breakdown by temple
    const templeBreakdownQuery = `
      SELECT 
        t.id as temple_id,
        t.name as temple_name,
        COUNT(DISTINCT f.id) as families,
        COUNT(DISTINCT fm.id) as members,
        COUNT(DISTINCT te.id) as teams,
        COUNT(DISTINCT ev.id) as events
      FROM temples t
      LEFT JOIN families f ON f.temple_id = t.id AND f.created_by = $1
      LEFT JOIN family_members fm ON fm.family_id IN (SELECT id FROM families WHERE temple_id = t.id AND created_by = $1)
      LEFT JOIN temple_groups te ON te.temple_id = t.id AND te.created_by = $1
      LEFT JOIN events ev ON ev.temple_id = t.id AND ev.created_by = $1
      WHERE EXISTS (
        SELECT 1 FROM user_temples ut 
        WHERE ut.user_id = $1 AND ut.temple_id = t.id AND ut.is_active = true
      )
      GROUP BY t.id, t.name
      HAVING COUNT(DISTINCT f.id) > 0 OR COUNT(DISTINCT fm.id) > 0 
         OR COUNT(DISTINCT te.id) > 0 OR COUNT(DISTINCT ev.id) > 0
      ORDER BY (
        COUNT(DISTINCT f.id) * 10 + 
        COUNT(DISTINCT fm.id) * 2
      ) DESC
    `;

    const templeBreakdown = await pool.query(templeBreakdownQuery, [userId]);

    res.json({
      success: true,
      data: {
        userId: data.user_id,
        userName: `${data.first_name} ${data.last_name || ''}`.trim(),
        email: data.email,
        role: data.role,
        temples_created: parseInt(data.temples_created) || 0,
        families_created: parseInt(data.families_created) || 0,
        members_added: parseInt(data.members_added) || 0,
        teams_created: parseInt(data.teams_created) || 0,
        events_created: parseInt(data.events_created) || 0,
        trustees_assigned: parseInt(data.trustees_assigned) || 0,
        admins_assigned: parseInt(data.admins_assigned) || 0,
        total_points: totalPoints,
        tier: tier,
        breakdown_by_temple: templeBreakdown.rows
      }
    });
  } catch (error) {
    console.error('Get user contributions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get contributions',
      error: error.message
    });
  }
};

/**
 * Get leaderboard
 * GET /api/admin/leaderboard
 */
exports.getLeaderboard = async (req, res) => {
  try {
    const { temple_id, period } = req.query;
    const parsedLimit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 500);

    const params = [];
    const templeParam = temple_id ? `$${params.push(temple_id)}` : null;

    let intervalSql = null;
    if (period === 'month') intervalSql = "INTERVAL '30 days'";
    if (period === 'week') intervalSql = "INTERVAL '7 days'";

    const dateCondition = (alias, field = 'created_at') =>
      intervalSql ? ` AND ${alias}.${field} >= NOW() - ${intervalSql}` : '';

    const query = `
      WITH temples_agg AS (
        SELECT
          t.created_by AS user_id,
          COUNT(*)::int AS temples_created
        FROM temples t
        WHERE t.created_by IS NOT NULL
          ${templeParam ? `AND t.id = ${templeParam}` : ''}
          ${dateCondition('t')}
        GROUP BY t.created_by
      ),
      families_agg AS (
        SELECT
          f.created_by AS user_id,
          COUNT(*)::int AS families_created
        FROM families f
        WHERE f.created_by IS NOT NULL
          ${templeParam ? `AND f.temple_id = ${templeParam}` : ''}
          ${dateCondition('f')}
        GROUP BY f.created_by
      ),
      members_agg AS (
        SELECT
          f.created_by AS user_id,
          COUNT(fm.id)::int AS members_added
        FROM family_members fm
        INNER JOIN families f ON f.id = fm.family_id
        WHERE f.created_by IS NOT NULL
          ${templeParam ? `AND f.temple_id = ${templeParam}` : ''}
          ${dateCondition('fm')}
        GROUP BY f.created_by
      ),
      teams_agg AS (
        SELECT
          tg.created_by AS user_id,
          COUNT(*)::int AS teams_created
        FROM temple_groups tg
        WHERE tg.created_by IS NOT NULL
          ${templeParam ? `AND tg.temple_id = ${templeParam}` : ''}
          ${dateCondition('tg')}
        GROUP BY tg.created_by
      ),
      events_agg AS (
        SELECT
          e.created_by AS user_id,
          COUNT(*)::int AS events_created
        FROM events e
        WHERE e.created_by IS NOT NULL
          ${templeParam ? `AND e.temple_id = ${templeParam}` : ''}
          ${dateCondition('e')}
        GROUP BY e.created_by
      )
      SELECT
        u.id AS user_id,
        u.first_name,
        u.last_name,
        u.email,
        u.role,
        COALESCE(ta.temples_created, 0) AS temples_created,
        COALESCE(fa.families_created, 0) AS families_created,
        COALESCE(ma.members_added, 0) AS members_added,
        COALESCE(tga.teams_created, 0) AS teams_created,
        COALESCE(ea.events_created, 0) AS events_created,
        (
          COALESCE(ta.temples_created, 0) * 100 +
          COALESCE(fa.families_created, 0) * 10 +
          COALESCE(ma.members_added, 0) * 2 +
          COALESCE(tga.teams_created, 0) * 20 +
          COALESCE(ea.events_created, 0) * 15
        ) AS total_points,
        (
          COALESCE(fa.families_created, 0) +
          COALESCE(ma.members_added, 0) +
          COALESCE(tga.teams_created, 0) +
          COALESCE(ea.events_created, 0)
        ) AS total_contributions
      FROM users u
      LEFT JOIN temples_agg ta ON ta.user_id = u.id
      LEFT JOIN families_agg fa ON fa.user_id = u.id
      LEFT JOIN members_agg ma ON ma.user_id = u.id
      LEFT JOIN teams_agg tga ON tga.user_id = u.id
      LEFT JOIN events_agg ea ON ea.user_id = u.id
      WHERE u.role IN ('admin', 'superadmin')
        AND (
          COALESCE(ta.temples_created, 0) +
          COALESCE(fa.families_created, 0) +
          COALESCE(ma.members_added, 0) +
          COALESCE(tga.teams_created, 0) +
          COALESCE(ea.events_created, 0)
        ) > 0
      ORDER BY total_points DESC, u.id ASC
      LIMIT $${params.push(parsedLimit)}
    `;

    const result = await pool.query(query, params);

    const leaderboard = result.rows.map((row, index) => ({
      rank: index + 1,
      user_id: row.user_id,
      name: `${row.first_name} ${row.last_name || ''}`.trim(),
      email: row.email,
      role: row.role,
      temples_created: parseInt(row.temples_created) || 0,
      families_created: parseInt(row.families_created) || 0,
      members_added: parseInt(row.members_added) || 0,
      teams_created: parseInt(row.teams_created) || 0,
      events_created: parseInt(row.events_created) || 0,
      total_contributions: parseInt(row.total_contributions) || 0,
      total_points: parseInt(row.total_points) || 0,
      tier: calculateTier(parseInt(row.total_points) || 0)
    }));

    res.json({
      success: true,
      data: {
        leaderboard,
        filters: {
          temple_id: temple_id || null,
          period: period || 'all-time',
          limit: parsedLimit
        }
      }
    });
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get leaderboard',
      error: error.message
    });
  }
};

/**
 * Get temple admin stats
 * GET /api/temples/:id/admin-stats
 */
exports.getTempleAdminStats = async (req, res) => {
  try {
    const { id: templeId } = req.params;

    // Get temple details
    const templeQuery = `SELECT id, name, location FROM temples WHERE id = $1`;
    const templeResult = await pool.query(templeQuery, [templeId]);

    if (templeResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Temple not found'
      });
    }

    const temple = templeResult.rows[0];

    // Get admin contributions for this temple
    const statsQuery = `
      SELECT 
        u.id as user_id,
        u.first_name,
        u.last_name,
        u.email,
        ut.role as temple_role,
        COUNT(DISTINCT f.id) as families_created,
        COUNT(DISTINCT fm.id) as members_added,
        COUNT(DISTINCT te.id) as teams_created,
        COUNT(DISTINCT ev.id) as events_created,
        (
          COUNT(DISTINCT f.id) * 10 +
          COUNT(DISTINCT fm.id) * 2 +
          COUNT(DISTINCT te.id) * 20 +
          COUNT(DISTINCT ev.id) * 15
        ) as total_points
      FROM users u
      INNER JOIN user_temples ut ON ut.user_id = u.id 
        AND ut.temple_id = $1 
        AND ut.is_active = true 
        AND ut.role = 'admin'
      LEFT JOIN families f ON f.created_by = u.id AND f.temple_id = $1
      LEFT JOIN family_members fm ON fm.created_by = u.id 
        AND fm.family_id IN (SELECT id FROM families WHERE temple_id = $1)
      LEFT JOIN temple_teams te ON te.created_by = u.id AND te.temple_id = $1
      LEFT JOIN temple_events ev ON ev.created_by = u.id AND ev.temple_id = $1
      GROUP BY u.id, u.first_name, u.last_name, u.email, ut.role
      ORDER BY total_points DESC
    `;

    const statsResult = await pool.query(statsQuery, [templeId]);

    const admins = statsResult.rows.map(row => ({
      user_id: row.user_id,
      name: `${row.first_name} ${row.last_name || ''}`.trim(),
      email: row.email,
      temple_role: row.temple_role,
      families_created: parseInt(row.families_created) || 0,
      members_added: parseInt(row.members_added) || 0,
      teams_created: parseInt(row.teams_created) || 0,
      events_created: parseInt(row.events_created) || 0,
      total_points: parseInt(row.total_points) || 0
    }));

    res.json({
      success: true,
      data: {
        temple_id: temple.id,
        temple_name: temple.name,
        temple_location: temple.location,
        admins,
        total_admins: admins.length,
        total_families: admins.reduce((sum, a) => sum + a.families_created, 0),
        total_members: admins.reduce((sum, a) => sum + a.members_added, 0),
        total_teams: admins.reduce((sum, a) => sum + a.teams_created, 0),
        total_events: admins.reduce((sum, a) => sum + a.events_created, 0)
      }
    });
  } catch (error) {
    console.error('Get temple admin stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get temple admin stats',
      error: error.message
    });
  }
};

module.exports = exports;
