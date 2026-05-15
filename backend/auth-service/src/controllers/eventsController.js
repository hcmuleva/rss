/**
 * =====================================================================
 * Events Controller
 * Company: emeelan
 * =====================================================================
 * Handles temple events management (Phase 1)
 */

const pool = require('../config/database');

/**
 * @route   GET /api/events?temple_id=X&group_id=Y&status=published&visibility=temple
 * @desc    Get all events with filters
 * @access  Private
 */
exports.getAllEvents = async (req, res) => {
  try {
    const { temple_id, group_id, status, visibility, from_date, to_date } = req.query;

    let query = `
      SELECT 
        e.id,
        e.temple_id as "templeId",
        e.group_id as "groupId",
        tg.name as "groupName",
        tg.group_type as "groupType",
        e.title,
        e.description,
        e.category,
        e.event_date as "eventDate",
        e.event_time as "eventTime",
        e.end_date as "endDate",
        e.end_time as "endTime",
        e.location,
        e.venue_name as "venueName",
        e.capacity,
        e.registration_required as "registrationRequired",
        e.registration_deadline as "registrationDeadline",
        e.organizer_id as "organizerId",
        e.organizer_name as "organizerName",
        e.contact_phone as "contactPhone",
        e.contact_email as "contactEmail",
        e.is_public as "isPublic",
        e.visibility,
        e.is_recurring as "isRecurring",
        e.recurrence_pattern as "recurrencePattern",
        e.status,
        e.cover_image_url as "coverImageUrl",
        e.created_by as "createdBy",
        e.created_at as "createdAt",
        COALESCE((SELECT COUNT(*) FROM event_participants WHERE event_id = e.id AND status != 'cancelled'), 0) as "registeredCount",
        COALESCE((SELECT COUNT(*) FROM event_participants WHERE event_id = e.id AND attended = true), 0) as "attendedCount"
      FROM events e
      JOIN temple_groups tg ON e.group_id = tg.id
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    // Visibility filter: Show events that are either:
    // 1. From the user's temple (if temple_id provided)
    // 2. Global visibility (visible to all temples)
    // 3. Public visibility (visible to everyone)
    if (temple_id) {
      query += ` AND (
        e.temple_id = $${paramIndex} 
        OR e.visibility = 'global' 
        OR e.visibility = 'public'
      )`;
      params.push(temple_id);
      paramIndex++;
    }

    if (group_id) {
      query += ` AND e.group_id = $${paramIndex}`;
      params.push(group_id);
      paramIndex++;
    }

    if (status) {
      query += ` AND e.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (visibility) {
      query += ` AND e.visibility = $${paramIndex}`;
      params.push(visibility);
      paramIndex++;
    }

    if (from_date) {
      query += ` AND e.event_date >= $${paramIndex}`;
      params.push(from_date);
      paramIndex++;
    }

    if (to_date) {
      query += ` AND e.event_date <= $${paramIndex}`;
      params.push(to_date);
      paramIndex++;
    }

    query += ` ORDER BY e.event_date ASC, e.event_time ASC`;

    const result = await pool.query(query, params);

    return res.status(200).json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('Get events error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch events'
    });
  }
};

/**
 * @route   GET /api/events/:id
 * @desc    Get single event by ID
 * @access  Private
 */
exports.getEventById = async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`[getEventById] Fetching event with id: ${id}`);

    const query = `
      SELECT 
        e.id,
        e.temple_id as "templeId",
        e.group_id as "groupId",
        tg.name as "groupName",
        tg.group_type as "groupType",
        e.title,
        e.description,
        e.category,
        e.event_date as "eventDate",
        e.event_time as "eventTime",
        e.end_date as "endDate",
        e.end_time as "endTime",
        e.location,
        e.venue_name as "venueName",
        e.capacity,
        e.registration_required as "registrationRequired",
        e.registration_deadline as "registrationDeadline",
        e.organizer_id as "organizerId",
        e.organizer_name as "organizerName",
        e.contact_phone as "contactPhone",
        e.contact_email as "contactEmail",
        e.is_public as "isPublic",
        e.visibility,
        e.is_recurring as "isRecurring",
        e.recurrence_pattern as "recurrencePattern",
        e.recurrence_end_date as "recurrenceEndDate",
        e.status,
        e.cover_image_url as "coverImageUrl",
        e.created_by as "createdBy",
        e.created_at as "createdAt",
        CONCAT(u.first_name, ' ', COALESCE(u.middle_name || ' ', ''), u.last_name) as "creatorName",
        COALESCE((SELECT COUNT(*) FROM event_participants WHERE event_id = e.id AND status != 'cancelled'), 0) as "registeredCount",
        COALESCE((SELECT COUNT(*) FROM event_participants WHERE event_id = e.id AND attended = true), 0) as "attendedCount"
      FROM events e
      JOIN temple_groups tg ON e.group_id = tg.id
      LEFT JOIN users u ON e.created_by = u.id
      WHERE e.id = $1
    `;

    const result = await pool.query(query, [id]);

    console.log(`[getEventById] Query result:`, result.rows.length > 0 ? 'Found event' : 'Event not found');

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Event not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('[getEventById] Error details:', error.message);
    console.error('[getEventById] Error stack:', error.stack);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch event',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @route   POST /api/events
 * @desc    Create new event
 * @access  Private (Admin)
 */
exports.createEvent = async (req, res) => {
  try {
    const {
      templeId,
      groupId,
      title,
      description,
      category,
      eventDate,
      eventTime,
      endDate,
      endTime,
      location,
      venueName,
      capacity,
      registrationRequired,
      registrationDeadline,
      organizerId,
      organizerName,
      contactPhone,
      contactEmail,
      isPublic,
      visibility,
      isRecurring,
      recurrencePattern,
      recurrenceEndDate,
      customRecurrence,
      status,
      coverImageUrl
    } = req.body;

    // Validation
    if (!templeId || !groupId || !title || !eventDate) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: templeId, groupId, title, eventDate'
      });
    }

    const query = `
      INSERT INTO events (
        temple_id, group_id, title, description, category,
        event_date, event_time, end_date, end_time,
        location, venue_name, capacity, registration_required, registration_deadline,
        organizer_id, organizer_name, contact_phone, contact_email,
        is_public, visibility, is_recurring, recurrence_pattern, recurrence_end_date, custom_recurrence,
        status, cover_image_url, created_by
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9,
        $10, $11, $12, $13, $14,
        $15, $16, $17, $18,
        $19, $20, $21, $22, $23, $24,
        $25, $26, $27
      ) RETURNING id, title, event_date as "eventDate", status
    `;

    const values = [
      templeId, groupId, title, description, category,
      eventDate, eventTime || null, endDate || null, endTime || null,
      location, venueName, capacity || null, registrationRequired || false, registrationDeadline || null,
      organizerId || null, organizerName, contactPhone, contactEmail,
      isPublic !== false, visibility || 'temple', isRecurring || false, recurrencePattern || null, recurrenceEndDate || null, customRecurrence || null,
      status || 'draft', coverImageUrl || null, req.user.id
    ];

    const result = await pool.query(query, values);

    return res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Event created successfully'
    });
  } catch (error) {
    console.error('Create event error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create event'
    });
  }
};

/**
 * @route   PUT /api/events/:id
 * @desc    Update event
 * @access  Private (Admin/Creator)
 */
exports.updateEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Build dynamic update query
    const allowedFields = [
      'title', 'description', 'category', 'event_date', 'event_time', 'end_date', 'end_time',
      'location', 'venue_name', 'capacity', 'registration_required', 'registration_deadline',
      'organizer_id', 'organizer_name', 'contact_phone', 'contact_email',
      'is_public', 'visibility', 'is_recurring', 'recurrence_pattern', 'recurrence_end_date', 'custom_recurrence',
      'status', 'cover_image_url'
    ];

    const setClauses = [];
    const values = [];
    let paramIndex = 1;

    Object.keys(updates).forEach(key => {
      const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      if (allowedFields.includes(snakeKey)) {
        setClauses.push(`${snakeKey} = $${paramIndex}`);
        values.push(updates[key]);
        paramIndex++;
      }
    });

    if (setClauses.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid fields to update'
      });
    }

    values.push(id);
    const query = `
      UPDATE events 
      SET ${setClauses.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramIndex}
      RETURNING id, title, status
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Event not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: result.rows[0],
      message: 'Event updated successfully'
    });
  } catch (error) {
    console.error('Update event error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update event'
    });
  }
};

/**
 * @route   DELETE /api/events/:id
 * @desc    Delete event
 * @access  Private (Admin)
 */
exports.deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;

    const query = 'DELETE FROM events WHERE id = $1 RETURNING id, title';
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Event not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Event deleted successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Delete event error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete event'
    });
  }
};

/**
 * @route   GET /api/events/settings/:templeId
 * @desc    Get event settings for temple
 * @access  Private
 */
exports.getEventSettings = async (req, res) => {
  try {
    const { templeId } = req.params;

    let query = 'SELECT * FROM event_settings WHERE temple_id = $1';
    let result = await pool.query(query, [templeId]);

    // If no settings exist, create default
    if (result.rows.length === 0) {
      const insertQuery = `
        INSERT INTO event_settings (temple_id)
        VALUES ($1)
        RETURNING *
      `;
      result = await pool.query(insertQuery, [templeId]);
    }

    return res.status(200).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Get event settings error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch event settings'
    });
  }
};

/**
 * @route   PUT /api/events/settings/:templeId
 * @desc    Update event settings for temple
 * @access  Private (Admin)
 */
exports.updateEventSettings = async (req, res) => {
  try {
    const { templeId } = req.params;
    const {
      visibleEventTypes,
      allowMemberCreateEvents,
      requireAdminApproval,
      defaultVisibility,
      enableRegistration,
      enableAttendance,
      enableMediaUpload
    } = req.body;

    const query = `
      UPDATE event_settings
      SET 
        visible_event_types = COALESCE($1, visible_event_types),
        allow_member_create_events = COALESCE($2, allow_member_create_events),
        require_admin_approval = COALESCE($3, require_admin_approval),
        default_visibility = COALESCE($4, default_visibility),
        enable_registration = COALESCE($5, enable_registration),
        enable_attendance = COALESCE($6, enable_attendance),
        enable_media_upload = COALESCE($7, enable_media_upload),
        updated_at = CURRENT_TIMESTAMP
      WHERE temple_id = $8
      RETURNING *
    `;

    const values = [
      visibleEventTypes ? JSON.stringify(visibleEventTypes) : null,
      allowMemberCreateEvents,
      requireAdminApproval,
      defaultVisibility,
      enableRegistration,
      enableAttendance,
      enableMediaUpload,
      templeId
    ];

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Event settings not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: result.rows[0],
      message: 'Event settings updated successfully'
    });
  } catch (error) {
    console.error('Update event settings error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update event settings'
    });
  }
};

/**
 * @route   GET /api/events/categories/:templeId
 * @desc    Get event categories for temple
 * @access  Private
 */
exports.getEventCategories = async (req, res) => {
  try {
    const { templeId } = req.params;

    const query = 'SELECT * FROM event_categories WHERE temple_id = $1 ORDER BY name ASC';
    const result = await pool.query(query, [templeId]);

    return res.status(200).json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('Get event categories error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch event categories'
    });
  }
};

/**
 * @route   POST /api/events/categories
 * @desc    Create event category
 * @access  Private (Admin)
 */
exports.createEventCategory = async (req, res) => {
  try {
    const { templeId, name, description, color, icon } = req.body;

    if (!templeId || !name) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: templeId, name'
      });
    }

    const query = `
      INSERT INTO event_categories (temple_id, name, description, color, icon)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const result = await pool.query(query, [templeId, name, description, color, icon]);

    return res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Event category created successfully'
    });
  } catch (error) {
    if (error.code === '23505') { // Unique violation
      return res.status(409).json({
        success: false,
        error: 'Category with this name already exists'
      });
    }

    console.error('Create event category error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create event category'
    });
  }
};

/**
 * @route   PUT /api/events/categories/:id
 * @desc    Update event category
 * @access  Private (Admin)
 */
exports.updateEventCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, color, icon } = req.body;

    const query = `
      UPDATE event_categories
      SET 
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        color = COALESCE($3, color),
        icon = COALESCE($4, icon)
      WHERE id = $5
      RETURNING *
    `;

    const result = await pool.query(query, [name, description, color, icon, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Event category not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: result.rows[0],
      message: 'Event category updated successfully'
    });
  } catch (error) {
    console.error('Update event category error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update event category'
    });
  }
};

/**
 * @route   DELETE /api/events/categories/:id
 * @desc    Delete event category
 * @access  Private (Admin)
 */
exports.deleteEventCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const query = 'DELETE FROM event_categories WHERE id = $1 RETURNING name';
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Event category not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Event category deleted successfully'
    });
  } catch (error) {
    console.error('Delete event category error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete event category'
    });
  }
};

/**
 * =====================================================================
 * PHASE 3: REGISTRATION & ATTENDANCE
 * =====================================================================
 */

/**
 * @route   POST /api/events/:id/register
 * @desc    Register current user for event
 * @access  Private
 */
exports.registerForEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { role, notes } = req.body;

    // Check if event exists and has capacity
    const eventQuery = 'SELECT capacity, registration_required, (SELECT COUNT(*) FROM event_participants WHERE event_id = $1 AND status != $2) as registered_count FROM events WHERE id = $1';
    const eventResult = await pool.query(eventQuery, [id, 'cancelled']);

    if (eventResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Event not found'
      });
    }

    const event = eventResult.rows[0];

    // Check if already registered
    const checkQuery = 'SELECT id, status FROM event_participants WHERE event_id = $1 AND user_id = $2';
    const checkResult = await pool.query(checkQuery, [id, userId]);

    if (checkResult.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Already registered for this event'
      });
    }

    // Determine status based on capacity
    let status = 'registered';
    if (event.capacity && event.registered_count >= event.capacity) {
      status = 'waitlist';
    }

    // Register user
    const insertQuery = `
      INSERT INTO event_participants (event_id, user_id, role, notes, status)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, status, registration_date as "registrationDate"
    `;

    const result = await pool.query(insertQuery, [id, userId, role || 'participant', notes, status]);

    return res.status(201).json({
      success: true,
      data: result.rows[0],
      message: status === 'waitlist' ? 'Added to waitlist' : 'Registration successful'
    });
  } catch (error) {
    console.error('Register for event error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to register for event'
    });
  }
};

/**
 * @route   GET /api/events/:id/participants
 * @desc    Get all participants for an event
 * @access  Private
 */
exports.getEventParticipants = async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        ep.id,
        ep.event_id as "eventId",
        ep.user_id as "userId",
        CONCAT(u.first_name, ' ', COALESCE(u.middle_name || ' ', ''), u.last_name) as "userName",
        u.email as "userEmail",
        u.phone as "userPhone",
        u.photo_url as "userPhoto",
        ep.status,
        ep.role,
        ep.attended,
        ep.attendance_marked_at as "attendanceMarkedAt",
        ep.registration_date as "registrationDate",
        ep.notes
      FROM event_participants ep
      JOIN users u ON ep.user_id = u.id
      WHERE ep.event_id = $1
      ORDER BY ep.registration_date ASC
    `;

    const result = await pool.query(query, [id]);

    // Calculate statistics
    const total = result.rows.length;
    const attended = result.rows.filter(p => p.attended).length;
    const registered = result.rows.filter(p => p.status === 'registered').length;
    const waitlist = result.rows.filter(p => p.status === 'waitlist').length;
    const cancelled = result.rows.filter(p => p.status === 'cancelled').length;

    return res.status(200).json({
      success: true,
      count: total,
      statistics: {
        total,
        registered,
        waitlist,
        cancelled,
        attended,
        attendanceRate: total > 0 ? ((attended / total) * 100).toFixed(1) : 0
      },
      data: result.rows
    });
  } catch (error) {
    console.error('Get event participants error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch participants'
    });
  }
};

/**
 * @route   PUT /api/events/:id/participants/:participantId/attendance
 * @desc    Mark attendance for a participant
 * @access  Private (Admin)
 */
exports.markAttendance = async (req, res) => {
  try {
    const { id, participantId } = req.params;
    const { attended } = req.body;
    const markedBy = req.user.id;

    const query = `
      UPDATE event_participants
      SET 
        attended = $1,
        attendance_marked_at = CURRENT_TIMESTAMP,
        attendance_marked_by = $2
      WHERE id = $3 AND event_id = $4
      RETURNING id, attended, attendance_marked_at as "attendanceMarkedAt"
    `;

    const result = await pool.query(query, [attended, markedBy, participantId, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Participant not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: result.rows[0],
      message: 'Attendance marked successfully'
    });
  } catch (error) {
    console.error('Mark attendance error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to mark attendance'
    });
  }
};

/**
 * @route   POST /api/events/:id/attendance/bulk
 * @desc    Bulk mark attendance for multiple participants
 * @access  Private (Admin)
 */
exports.bulkMarkAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const { participantIds, attended } = req.body;
    const markedBy = req.user.id;

    if (!Array.isArray(participantIds) || participantIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'participantIds must be a non-empty array'
      });
    }

    const query = `
      UPDATE event_participants
      SET 
        attended = $1,
        attendance_marked_at = CURRENT_TIMESTAMP,
        attendance_marked_by = $2
      WHERE id = ANY($3::int[]) AND event_id = $4
      RETURNING id
    `;

    const result = await pool.query(query, [attended, markedBy, participantIds, id]);

    return res.status(200).json({
      success: true,
      count: result.rows.length,
      message: `Attendance marked for ${result.rows.length} participant(s)`
    });
  } catch (error) {
    console.error('Bulk mark attendance error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to mark attendance'
    });
  }
};

/**
 * @route   POST /api/events/:id/documents
 * @desc    Upload document for event (resolution, minutes, etc.)
 * @access  Private (Admin)
 */
exports.uploadEventDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      documentType,
      title,
      description,
      fileUrl,
      fileName,
      fileSize,
      fileType,
      isPublic
    } = req.body;

    const query = `
      INSERT INTO event_documents (
        event_id, document_type, title, description,
        file_url, file_name, file_size, file_type,
        uploaded_by, is_public
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, title, document_type as "documentType", file_url as "fileUrl"
    `;

    const values = [
      id,
      documentType,
      title,
      description,
      fileUrl,
      fileName,
      fileSize,
      fileType,
      req.user.id,
      isPublic !== false
    ];

    const result = await pool.query(query, values);

    return res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Document uploaded successfully'
    });
  } catch (error) {
    console.error('Upload event document error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to upload document'
    });
  }
};

/**
 * @route   GET /api/events/:id/documents
 * @desc    Get all documents for an event
 * @access  Private
 */
exports.getEventDocuments = async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        ed.id,
        ed.event_id as "eventId",
        ed.document_type as "documentType",
        ed.title,
        ed.description,
        ed.file_url as "fileUrl",
        ed.file_name as "fileName",
        ed.file_size as "fileSize",
        ed.file_type as "fileType",
        ed.is_public as "isPublic",
        ed.uploaded_at as "uploadedAt",
        CONCAT(u.first_name, ' ', COALESCE(u.middle_name || ' ', ''), u.last_name) as "uploadedBy"
      FROM event_documents ed
      LEFT JOIN users u ON ed.uploaded_by = u.id
      WHERE ed.event_id = $1
      ORDER BY ed.display_order ASC, ed.uploaded_at DESC
    `;

    const result = await pool.query(query, [id]);

    return res.status(200).json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('Get event documents error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch documents'
    });
  }
};

/**
 * @route   DELETE /api/events/:id/documents/:documentId
 * @desc    Delete event document
 * @access  Private (Admin)
 */
exports.deleteEventDocument = async (req, res) => {
  try {
    const { id, documentId } = req.params;

    const query = 'DELETE FROM event_documents WHERE id = $1 AND event_id = $2 RETURNING title';
    const result = await pool.query(query, [documentId, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Document deleted successfully'
    });
  } catch (error) {
    console.error('Delete event document error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete document'
    });
  }
};
