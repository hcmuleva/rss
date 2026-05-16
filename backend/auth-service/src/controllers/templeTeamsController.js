/**
 * =====================================================================
 * Temple Teams Controller
 * Company: emeelan
 * =====================================================================
 * Handles all temple teams/groups operations:
 * - Get groups with categories
 * - Members management (add, remove, update roles)
 * - Messages (Ably integration ready)
 * - Events
 * - Documents
 */

const pool = require('../config/database');
let templeGroupsSchemaReady = false;

const ensureTempleGroupsSchema = async () => {
  if (templeGroupsSchemaReady) return;
  await pool.query(`ALTER TABLE IF EXISTS temple_groups ADD COLUMN IF NOT EXISTS photo_url TEXT`);
  templeGroupsSchemaReady = true;
};

/**
 * @route   PUT /api/temple-teams/groups/:groupId/photo
 * @desc    Update group photo URL
 * @access  Private
 */
exports.updateGroupPhoto = async (req, res) => {
  try {
    await ensureTempleGroupsSchema();
    const { groupId } = req.params;
    const { photoUrl } = req.body;

    const query = `
      UPDATE temple_groups 
      SET photo_url = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, name, photo_url as "photoUrl"
    `;

    const result = await pool.query(query, [photoUrl, groupId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Group not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: result.rows[0],
      message: 'Group photo updated successfully'
    });
  } catch (error) {
    console.error('Error updating group photo:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update group photo'
    });
  }
};

/**
 * @route   PUT /api/temple-teams/temple/:templeId/visible-groups
 * @desc    Update which groups are visible for a temple
 * @access  Private (admin only)
 */
exports.updateTempleVisibleGroups = async (req, res) => {
  try {
    const { templeId } = req.params;
    const { visibleGroups } = req.body;

    if (!visibleGroups || !Array.isArray(visibleGroups)) {
      return res.status(400).json({
        success: false,
        error: 'visibleGroups must be an array'
      });
    }

    const validGroupTypes = ['trustee', 'business', 'sanskar', 'education', 'agriculture', 'ladies', 'dance', 'jobs', 'cultural', 'sports', 'voting', 'polling', 'committee', 'yuva'];
    
    const invalidGroups = visibleGroups.filter(g => !validGroupTypes.includes(g));
    if (invalidGroups.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Invalid group types: ${invalidGroups.join(', ')}`
      });
    }

    const query = `
      UPDATE temples 
      SET visible_groups = $1::jsonb
      WHERE id = $2
      RETURNING id, name, visible_groups as "visibleGroups"
    `;

    const result = await pool.query(query, [JSON.stringify(visibleGroups), templeId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Temple not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: result.rows[0],
      message: 'Temple visible groups updated successfully'
    });
  } catch (error) {
    console.error('Error updating temple visible groups:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update temple visible groups'
    });
  }
};

/**
 * @route   GET /api/temple-teams/users/search
 * @desc    Search users for adding to groups
 * @access  Private
 */
exports.searchUsers = async (req, res) => {
  try {
    const { temple_id, query } = req.query;

    if (!temple_id) {
      return res.status(400).json({
        success: false,
        error: 'temple_id is required'
      });
    }

    // Build search query
    let searchCondition = '1=1';
    const queryParams = [temple_id];
    
    if (query && query.trim()) {
      searchCondition = `(
        u.first_name ILIKE $2 OR 
        u.last_name ILIKE $2 OR 
        u.email ILIKE $2 OR
        (u.first_name || ' ' || u.last_name) ILIKE $2
      )`;
      queryParams.push(`%${query.trim()}%`);
    }

    const result = await pool.query(
      `SELECT 
        u.id,
        u.first_name,
        u.last_name,
        u.email,
        u.phone,
        ut.temple_id,
        t.name as temple_name,
        CASE 
          WHEN ut.temple_id = $1 THEN 'temple'
          WHEN ut.temple_id IS NOT NULL THEN 'other-temple'
          ELSE 'external'
        END as source,
        CASE 
          WHEN ut.temple_id = $1 THEN t.name
          WHEN ut.temple_id IS NOT NULL THEN t.name
          ELSE 'External User'
        END as source_detail
      FROM users u
      LEFT JOIN user_temples ut ON ut.user_id = u.id
      LEFT JOIN temples t ON t.id = ut.temple_id
      WHERE ${searchCondition}
      ORDER BY 
        CASE 
          WHEN ut.temple_id = $1 THEN 1
          WHEN ut.temple_id IS NOT NULL THEN 2
          ELSE 3
        END,
        u.first_name, u.last_name
      LIMIT 50`,
      queryParams
    );

    // Format results
    const users = result.rows.map(row => ({
      id: row.id,
      name: `${row.first_name || ''} ${row.last_name || ''}`.trim() || 'No Name',
      email: row.email,
      phone: row.phone,
      source: row.source,
      sourceDetail: row.source_detail
    }));

    return res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    console.error('Error searching users:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to search users'
    });
  }
};

/**
 * @route   GET /api/temple-teams/groups
 * @desc    Get all groups for a temple with member counts (filtered by temple's visible_groups)
 * @access  Private
 */
exports.getAllGroups = async (req, res) => {
  try {
    await ensureTempleGroupsSchema();
    const { temple_id } = req.query;

    if (!temple_id) {
      return res.status(400).json({
        success: false,
        error: 'temple_id is required',
      });
    }

    // Get temple's visible groups and name
    const templeResult = await pool.query(
      'SELECT name, visible_groups FROM temples WHERE id = $1',
      [temple_id]
    );

    const temple = templeResult.rows[0];
    const visibleGroups = temple?.visible_groups || [];
    
    console.log('🔍 getAllGroups - temple_id:', temple_id);
    console.log('🔍 getAllGroups - temple:', temple);
    console.log('🔍 getAllGroups - visibleGroups:', visibleGroups);
    console.log('🔍 getAllGroups - visibleGroups type:', typeof visibleGroups, Array.isArray(visibleGroups));

    const query = `
      SELECT 
        g.id,
        g.name,
        g.description,
        g.icon,
        g.group_type as "groupType",
        g.is_public as "isPublic",
        g.enabled_tabs as "enabledTabs",
        g.photo_url as "photoUrl",
        (SELECT COUNT(DISTINCT user_id) FROM temple_group_members WHERE group_id = g.id) as "memberCount",
        (SELECT COUNT(*) FROM temple_group_members WHERE group_id = g.id AND role = 'moderator') as "moderatorCount",
        (SELECT COUNT(*) FROM temple_group_messages WHERE group_id = g.id) as "messageCount",
        g.created_at as "createdAt"
      FROM temple_groups g
      WHERE g.temple_id = $1
        AND g.group_type = ANY($2::text[])
      ORDER BY g.id
    `;

    const result = await pool.query(query, [temple_id, visibleGroups]);

    res.status(200).json({
      success: true,
      count: result.rows.length,
      data: result.rows,
      temple: {
        name: temple?.name || '',
        visibleGroups: visibleGroups
      }
    });
  } catch (error) {
    console.error('Get groups error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

/**
 * @route   PUT /api/temple-teams/groups/:groupId/settings
 * @desc    Update group settings (enabled tabs, visibility, etc.)
 * @access  Private (admin only)
 */
exports.updateGroupSettings = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { enabledTabs, isPublic } = req.body;

    // Validate enabled tabs
    const validTabs = ['members', 'messages', 'events', 'documents'];
    if (enabledTabs) {
      if (!Array.isArray(enabledTabs)) {
        return res.status(400).json({
          success: false,
          error: 'enabledTabs must be an array'
        });
      }
      
      const invalidTabs = enabledTabs.filter(tab => !validTabs.includes(tab));
      if (invalidTabs.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Invalid tabs: ${invalidTabs.join(', ')}. Valid tabs are: ${validTabs.join(', ')}`
        });
      }
    }

    // Build update query
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (enabledTabs !== undefined) {
      updates.push(`enabled_tabs = $${paramIndex}::jsonb`);
      values.push(JSON.stringify(enabledTabs));
      paramIndex++;
    }

    if (isPublic !== undefined) {
      updates.push(`is_public = $${paramIndex}`);
      values.push(isPublic);
      paramIndex++;
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No settings to update'
      });
    }

    values.push(groupId);

    const query = `
      UPDATE temple_groups 
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING 
        id,
        name,
        enabled_tabs as "enabledTabs",
        is_public as "isPublic"
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Group not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: result.rows[0],
      message: 'Group settings updated successfully'
    });
  } catch (error) {
    console.error('Error updating group settings:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update group settings'
    });
  }
};

/**
 * @route   GET /api/temple-teams/groups/:groupId/categories
 * @desc    Get categories for a group
 * @access  Private
 */
exports.getGroupCategories = async (req, res) => {
  try {
    const { groupId } = req.params;

    const query = `
      SELECT 
        c.id,
        c.name,
        c.description,
        (SELECT COUNT(DISTINCT user_id) FROM temple_group_members WHERE category_id = c.id) as "memberCount",
        c.display_order as "displayOrder"
      FROM temple_group_categories c
      WHERE c.group_id = $1
      ORDER BY c.display_order, c.name
    `;

    const result = await pool.query(query, [groupId]);

    res.status(200).json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

/**
 * @route   GET /api/temple-teams/groups/:groupId/members
 * @desc    Get all members for a group with their roles
 * @access  Private
 */
exports.getGroupMembers = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { category_id } = req.query;

    let query = `
      SELECT DISTINCT ON (m.user_id, m.category_id)
        m.id,
        m.user_id as "userId",
        m.category_id as "categoryId",
        m.role,
        m.category_roles as "categoryRoles",
        m.notes,
        m.joined_at as "joinedAt",
        u.first_name as "firstName",
        u.middle_name as "middleName",
        u.last_name as "lastName",
        u.email,
        u.phone,
        u.gender,
        u.dob,
        COALESCE(u.profile_photo_url, u.photo_url) as "photoUrl",
        EXTRACT(YEAR FROM AGE(COALESCE(u.dob, CURRENT_DATE))) as age,
        c.name as "categoryName",
        CASE 
          WHEN ut.member_type = 'external_to_temple' THEN 'external'
          WHEN (SELECT COUNT(*) FROM user_temples WHERE user_id = u.id AND is_active = true) > 1 THEN 'other-temple'
          ELSE 'temple'
        END as source,
        COALESCE(t.name, 'Unknown Temple') as "sourceDetail"
      FROM temple_group_members m
      JOIN users u ON m.user_id = u.id
      LEFT JOIN temple_group_categories c ON m.category_id = c.id
      LEFT JOIN user_temples ut ON ut.user_id = u.id AND ut.is_active = true
      LEFT JOIN temples t ON t.id = ut.temple_id
      WHERE m.group_id = $1
    `;

    const params = [groupId];

    if (category_id) {
      query += ' AND m.category_id = $2';
      params.push(category_id);
    }

    query += ' ORDER BY m.user_id, m.category_id, m.joined_at DESC';

    const result = await pool.query(query, params);

    // Group by user and aggregate their category roles
    const membersMap = new Map();
    
    result.rows.forEach(row => {
      const userId = row.userId;
      
      if (!membersMap.has(userId)) {
        membersMap.set(userId, {
          id: row.id,
          userId: row.userId,
          name: `${row.firstName} ${row.middleName || ''} ${row.lastName || ''}`.trim(),
          email: row.email,
          phone: row.phone,
          gender: row.gender,
          dob: row.dob,
          age: row.age ? parseInt(row.age) : null,
          photoUrl: row.photoUrl,
          notes: row.notes,
          source: row.source,
          sourceDetail: row.sourceDetail,
          role: row.role,
          roles: row.categoryRoles || [], // Flattened roles array
          memberRoles: [],
          joinedAt: row.joinedAt,
        });
      }

      const member = membersMap.get(userId);
      
      if (row.categoryId && row.categoryName) {
        member.memberRoles.push({
          categoryId: row.categoryId,
          categoryName: row.categoryName,
          roles: row.categoryRoles || [],
        });
      }
    });

    const members = Array.from(membersMap.values());

    res.status(200).json({
      success: true,
      count: members.length,
      data: members,
    });
  } catch (error) {
    console.error('Get members error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

/**
 * @route   POST /api/temple-teams/groups/members
 * @desc    Add a single member to a group with multiple roles (simplified - no category required)
 * @access  Private
 */
exports.addMemberWithRoles = async (req, res) => {
  try {
    const { groupId, userId, roles, notes } = req.body;
    const addedBy = req.user?.id;

    console.log('🎯 Adding member to group:', { groupId, userId, roles, notes });

    if (!groupId || !userId) {
      return res.status(400).json({
        success: false,
        error: 'groupId and userId are required',
      });
    }

    if (!roles || !Array.isArray(roles) || roles.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one role is required',
      });
    }

    // Check if member already exists in this group
    const existingCheck = await pool.query(
      `SELECT id FROM temple_group_members 
       WHERE group_id = $1 AND user_id = $2 AND category_id IS NULL`,
      [groupId, userId]
    );

    if (existingCheck.rows.length > 0) {
      // Update existing member's roles
      const updateQuery = `
        UPDATE temple_group_members
        SET category_roles = $1, notes = $2, updated_at = CURRENT_TIMESTAMP
        WHERE group_id = $3 AND user_id = $4 AND category_id IS NULL
        RETURNING id, user_id as "userId", category_roles as "roles"
      `;
      
      const result = await pool.query(updateQuery, [roles, notes, groupId, userId]);
      
      console.log('✅ Member roles updated');

      return res.status(200).json({
        success: true,
        message: 'Member roles updated successfully',
        data: result.rows[0],
      });
    }

    // Insert new member
    const insertQuery = `
      INSERT INTO temple_group_members 
      (group_id, user_id, category_id, role, category_roles, notes, added_by, created_at, updated_at)
      VALUES ($1, $2, NULL, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id, user_id as "userId", category_roles as "roles"
    `;

    const result = await pool.query(insertQuery, [
      groupId,
      userId,
      'member', // Default role
      roles, // Array of roles (student, teacher, sponsor, coordinator)
      notes,
      addedBy,
    ]);

    console.log('✅ Member added successfully');

    return res.status(201).json({
      success: true,
      message: 'Member added successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('❌ Error adding member with roles:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to add member',
    });
  }
};

/**
 * @route   POST /api/temple-teams/groups/:groupId/members
 * @desc    Add members to a group with category and roles (batch operation)
 * @access  Private
 */
exports.addGroupMembers = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { members } = req.body; // Array of { userId, categoryId, roles: [] }
    const addedBy = req.user.id;

    if (!members || !Array.isArray(members) || members.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'members array is required',
      });
    }

    const insertedMembers = [];

    for (const member of members) {
      const { userId, categoryId, roles } = member;

      if (!userId || !categoryId || !roles) {
        continue;
      }

      const query = `
        INSERT INTO temple_group_members 
        (group_id, category_id, user_id, role, category_roles, added_by)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (group_id, category_id, user_id)
        DO UPDATE SET 
          category_roles = $5,
          updated_at = CURRENT_TIMESTAMP
        RETURNING id, user_id as "userId", category_id as "categoryId", category_roles as "categoryRoles"
      `;

      const result = await pool.query(query, [
        groupId,
        categoryId,
        userId,
        'member',
        roles,
        addedBy,
      ]);

      insertedMembers.push(result.rows[0]);
    }

    res.status(201).json({
      success: true,
      message: `Added ${insertedMembers.length} members successfully`,
      data: insertedMembers,
    });
  } catch (error) {
    console.error('Add members error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

/**
 * @route   DELETE /api/temple-teams/groups/:groupId/members/:memberId
 * @desc    Remove a member from a group
 * @access  Private
 */
exports.removeGroupMember = async (req, res) => {
  try {
    const { groupId, memberId } = req.params;

    const query = 'DELETE FROM temple_group_members WHERE id = $1 AND group_id = $2';
    await pool.query(query, [memberId, groupId]);

    res.status(200).json({
      success: true,
      message: 'Member removed successfully',
    });
  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

/**
 * @route   POST /api/temple-teams/groups/:groupId/messages
 * @desc    Send message to group (Ably integration ready)
 * @access  Private
 */
exports.sendGroupMessage = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { subject, message, attachments, categoryId } = req.body;
    const senderId = req.user.id;

    if (!subject || !message) {
      return res.status(400).json({
        success: false,
        error: 'subject and message are required',
      });
    }

    const query = `
      INSERT INTO temple_group_messages 
      (group_id, category_id, sender_id, subject, message, attachments)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING 
        id,
        subject,
        message,
        sent_at as "sentAt"
    `;

    const result = await pool.query(query, [
      groupId,
      categoryId || null,
      senderId,
      subject,
      message,
      JSON.stringify(attachments || []),
    ]);

    // TODO: Publish to Ably channel: temple.{groupId}.messages
    // const channel = ably.channels.get(`temple.${groupId}.messages`);
    // channel.publish('new-message', result.rows[0]);

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

/**
 * @route   GET /api/temple-teams/groups/:groupId/messages
 * @desc    Get messages for a group
 * @access  Private
 */
exports.getGroupMessages = async (req, res) => {
  try {
    const { groupId } = req.params;

    const query = `
      SELECT 
        m.id,
        m.subject,
        m.message,
        m.attachments,
        m.sent_at as "sentAt",
        m.sender_id as "senderId",
        u.first_name || ' ' || COALESCE(u.last_name, '') as "senderName"
      FROM temple_group_messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.group_id = $1
      ORDER BY m.sent_at DESC
      LIMIT 50
    `;

    const result = await pool.query(query, [groupId]);

    res.status(200).json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

/**
 * @route   POST /api/temple-teams/groups/:groupId/events
 * @desc    Create event for a group
 * @access  Private
 */
exports.createGroupEvent = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { title, description, eventDate, eventTime, location, categoryId } = req.body;
    const createdBy = req.user.id;

    if (!title || !eventDate || !eventTime) {
      return res.status(400).json({
        success: false,
        error: 'title, eventDate, and eventTime are required',
      });
    }

    const query = `
      INSERT INTO temple_group_events 
      (group_id, category_id, title, description, event_date, event_time, location, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING 
        id,
        title,
        description,
        event_date as "date",
        event_time as "time",
        location,
        created_at as "createdAt"
    `;

    const result = await pool.query(query, [
      groupId,
      categoryId || null,
      title,
      description || '',
      eventDate,
      eventTime,
      location || '',
      createdBy,
    ]);

    res.status(201).json({
      success: true,
      message: 'Event created successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

/**
 * @route   GET /api/temple-teams/groups/:groupId/events
 * @desc    Get events for a group
 * @access  Private
 */
exports.getGroupEvents = async (req, res) => {
  try {
    const { groupId } = req.params;

    const query = `
      SELECT 
        e.id,
        e.title,
        e.description,
        e.event_date as "date",
        e.event_time as "time",
        e.location,
        e.created_by as "createdBy",
        u.first_name || ' ' || COALESCE(u.last_name, '') as "createdByName",
        e.created_at as "createdAt"
      FROM temple_group_events e
      JOIN users u ON e.created_by = u.id
      WHERE e.group_id = $1
      ORDER BY e.event_date DESC, e.event_time DESC
    `;

    const result = await pool.query(query, [groupId]);

    res.status(200).json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

/**
 * @route   POST /api/temple-teams/groups/:groupId/documents
 * @desc    Upload documents to a group
 * @access  Private
 */
exports.uploadGroupDocuments = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { documents, categoryId } = req.body; // Array of { name, fileType, fileSize, fileUrl }
    const uploadedBy = req.user.id;

    if (!documents || !Array.isArray(documents) || documents.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'documents array is required',
      });
    }

    const uploadedDocs = [];

    for (const doc of documents) {
      const { name, fileType, fileSize, fileUrl } = doc;

      const query = `
        INSERT INTO temple_group_documents 
        (group_id, category_id, name, file_type, file_size, file_url, uploaded_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, name, file_type as "fileType", file_size as "fileSize", file_url as "fileUrl", uploaded_at as "uploadedAt"
      `;

      const result = await pool.query(query, [
        groupId,
        categoryId || null,
        name,
        fileType,
        fileSize,
        fileUrl,
        uploadedBy,
      ]);

      uploadedDocs.push(result.rows[0]);
    }

    res.status(201).json({
      success: true,
      message: `Uploaded ${uploadedDocs.length} documents successfully`,
      data: uploadedDocs,
    });
  } catch (error) {
    console.error('Upload documents error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

/**
 * @route   GET /api/temple-teams/groups/:groupId/documents
 * @desc    Get documents for a group
 * @access  Private
 */
exports.getGroupDocuments = async (req, res) => {
  try {
    const { groupId } = req.params;

    const query = `
      SELECT 
        d.id,
        d.name,
        d.file_type as "type",
        d.file_size as "size",
        d.file_url as "url",
        d.uploaded_by as "uploadedById",
        u.first_name || ' ' || COALESCE(u.last_name, '') as "uploadedBy",
        d.uploaded_at as "uploadedAt"
      FROM temple_group_documents d
      JOIN users u ON d.uploaded_by = u.id
      WHERE d.group_id = $1
      ORDER BY d.uploaded_at DESC
    `;

    const result = await pool.query(query, [groupId]);

    res.status(200).json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};
