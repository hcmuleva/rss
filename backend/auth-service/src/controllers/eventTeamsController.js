/**
 * =====================================================================
 * Event Teams Controller
 * Company: emeelan
 * =====================================================================
 * Handles team formation and management for event occurrences
 */

const pool = require('../config/database');

/**
 * @route   GET /api/occurrences/:id/teams
 * @desc    Get all teams for an occurrence
 * @access  Private
 */
exports.getOccurrenceTeams = async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        t.id,
        t.occurrence_id as "occurrenceId",
        t.team_name as "teamName",
        t.team_photo_url as "teamPhotoUrl",
        t.team_color as "teamColor",
        t.captain_user_id as "captainUserId",
        CONCAT(u.first_name, ' ', COALESCE(u.middle_name || ' ', ''), u.last_name) as "captainName",
        t.max_members as "maxMembers",
        t.total_score as "totalScore",
        t.rank,
        t.is_active as "isActive",
        t.created_at as "createdAt",
        (SELECT COUNT(*) FROM event_team_members WHERE team_id = t.id AND is_active = true) as "memberCount"
      FROM event_teams t
      LEFT JOIN users u ON t.captain_user_id = u.id
      WHERE t.occurrence_id = $1 AND t.is_active = true
      ORDER BY t.rank ASC NULLS LAST, t.total_score DESC, t.created_at ASC
    `;

    const result = await pool.query(query, [id]);

    return res.status(200).json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('Get occurrence teams error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch teams'
    });
  }
};

/**
 * @route   POST /api/occurrences/:id/teams
 * @desc    Create a new team
 * @access  Private
 */
exports.createTeam = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { teamName, teamColor, maxMembers } = req.body;

    // Validate team name
    if (!teamName || teamName.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Team name is required'
      });
    }

    // Check if user already in a team for this occurrence
    const checkQuery = `
      SELECT t.id, t.team_name
      FROM event_teams t
      JOIN event_team_members tm ON t.id = tm.team_id
      WHERE t.occurrence_id = $1 AND tm.user_id = $2 AND tm.is_active = true
    `;
    const checkResult = await pool.query(checkQuery, [id, userId]);

    if (checkResult.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: `You are already in team "${checkResult.rows[0].team_name}"`
      });
    }

    // Create team
    const createTeamQuery = `
      INSERT INTO event_teams (
        occurrence_id, team_name, team_color, captain_user_id, max_members
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, team_name as "teamName", team_color as "teamColor", 
                captain_user_id as "captainUserId", max_members as "maxMembers"
    `;

    const teamResult = await pool.query(createTeamQuery, [
      id,
      teamName.trim(),
      teamColor || '#FF6B6B',
      userId,
      maxMembers || 6
    ]);

    const team = teamResult.rows[0];

    // Add creator as team member (captain)
    const addMemberQuery = `
      INSERT INTO event_team_members (team_id, user_id, role)
      VALUES ($1, $2, 'captain')
    `;
    await pool.query(addMemberQuery, [team.id, userId]);

    return res.status(201).json({
      success: true,
      data: {
        ...team,
        memberCount: 1,
        captainName: req.user.name || 'You'
      },
      message: 'Team created successfully'
    });
  } catch (error) {
    console.error('Create team error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create team'
    });
  }
};

/**
 * @route   POST /api/teams/:id/join
 * @desc    Join an existing team
 * @access  Private
 */
exports.joinTeam = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Get team details
    const teamQuery = `
      SELECT 
        t.*,
        (SELECT COUNT(*) FROM event_team_members WHERE team_id = t.id AND is_active = true) as member_count
      FROM event_teams t
      WHERE t.id = $1 AND t.is_active = true
    `;
    const teamResult = await pool.query(teamQuery, [id]);

    if (teamResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Team not found'
      });
    }

    const team = teamResult.rows[0];

    // Check if team is full
    if (team.member_count >= team.max_members) {
      return res.status(409).json({
        success: false,
        error: 'Team is full'
      });
    }

    // Check if user already in a team for this occurrence
    const checkQuery = `
      SELECT t.id, t.team_name
      FROM event_teams t
      JOIN event_team_members tm ON t.id = tm.team_id
      WHERE t.occurrence_id = $1 AND tm.user_id = $2 AND tm.is_active = true
    `;
    const checkResult = await pool.query(checkQuery, [team.occurrence_id, userId]);

    if (checkResult.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: `You are already in team "${checkResult.rows[0].team_name}"`
      });
    }

    // Add user to team
    const addMemberQuery = `
      INSERT INTO event_team_members (team_id, user_id, role)
      VALUES ($1, $2, 'member')
      RETURNING id
    `;
    await pool.query(addMemberQuery, [id, userId]);

    return res.status(200).json({
      success: true,
      message: `Successfully joined team "${team.team_name}"`
    });
  } catch (error) {
    console.error('Join team error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to join team'
    });
  }
};

/**
 * @route   GET /api/teams/:id/members
 * @desc    Get team members
 * @access  Private
 */
exports.getTeamMembers = async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        tm.id,
        tm.user_id as "userId",
        CONCAT(u.first_name, ' ', COALESCE(u.middle_name || ' ', ''), u.last_name) as "userName",
        u.email,
        u.photo_url as "photoUrl",
        tm.role,
        tm.joined_at as "joinedAt",
        tm.is_active as "isActive"
      FROM event_team_members tm
      JOIN users u ON tm.user_id = u.id
      WHERE tm.team_id = $1 AND tm.is_active = true
      ORDER BY 
        CASE WHEN tm.role = 'captain' THEN 0 ELSE 1 END,
        tm.joined_at ASC
    `;

    const result = await pool.query(query, [id]);

    return res.status(200).json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('Get team members error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch team members'
    });
  }
};

/**
 * @route   DELETE /api/teams/:id/members/:userId
 * @desc    Remove member from team (captain only)
 * @access  Private
 */
exports.removeMember = async (req, res) => {
  try {
    const { id, userId } = req.params;
    const requestUserId = req.user.id;

    // Check if requester is captain
    const captainCheck = await pool.query(
      'SELECT captain_user_id FROM event_teams WHERE id = $1',
      [id]
    );

    if (captainCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Team not found'
      });
    }

    if (captainCheck.rows[0].captain_user_id !== requestUserId) {
      return res.status(403).json({
        success: false,
        error: 'Only team captain can remove members'
      });
    }

    // Cannot remove captain
    if (parseInt(userId) === requestUserId) {
      return res.status(400).json({
        success: false,
        error: 'Captain cannot remove themselves'
      });
    }

    // Remove member
    const removeQuery = `
      UPDATE event_team_members
      SET is_active = false
      WHERE team_id = $1 AND user_id = $2
      RETURNING id
    `;
    const result = await pool.query(removeQuery, [id, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Member not found in team'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Member removed from team'
    });
  } catch (error) {
    console.error('Remove member error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to remove member'
    });
  }
};

/**
 * @route   DELETE /api/teams/:id/leave
 * @desc    Leave team
 * @access  Private
 */
exports.leaveTeam = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if user is captain
    const teamQuery = await pool.query(
      'SELECT captain_user_id FROM event_teams WHERE id = $1',
      [id]
    );

    if (teamQuery.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Team not found'
      });
    }

    if (teamQuery.rows[0].captain_user_id === userId) {
      return res.status(400).json({
        success: false,
        error: 'Captain must transfer leadership or delete team before leaving'
      });
    }

    // Remove user from team
    const leaveQuery = `
      UPDATE event_team_members
      SET is_active = false
      WHERE team_id = $1 AND user_id = $2
      RETURNING id
    `;
    const result = await pool.query(leaveQuery, [id, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'You are not a member of this team'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Successfully left team'
    });
  } catch (error) {
    console.error('Leave team error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to leave team'
    });
  }
};

/**
 * @route   DELETE /api/teams/:id
 * @desc    Delete team (captain only)
 * @access  Private
 */
exports.deleteTeam = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if user is captain
    const teamQuery = await pool.query(
      'SELECT captain_user_id, team_name FROM event_teams WHERE id = $1',
      [id]
    );

    if (teamQuery.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Team not found'
      });
    }

    if (teamQuery.rows[0].captain_user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Only team captain can delete team'
      });
    }

    // Soft delete team
    await pool.query(
      'UPDATE event_teams SET is_active = false WHERE id = $1',
      [id]
    );

    // Deactivate all members
    await pool.query(
      'UPDATE event_team_members SET is_active = false WHERE team_id = $1',
      [id]
    );

    return res.status(200).json({
      success: true,
      message: `Team "${teamQuery.rows[0].team_name}" deleted successfully`
    });
  } catch (error) {
    console.error('Delete team error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete team'
    });
  }
};
