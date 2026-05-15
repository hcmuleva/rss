const KaryakariniModel = require('../models/KaryakariniModel');
const { isAdminRole } = require('../middleware/auth');
const { uploadBufferToS3, sanitizeFileName } = require('../config/s3');
const ablyService = require('../services/ablyService');

const parsePositiveNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const normalizeRole = (role) =>
  String(role || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, '');

const parseNumberArray = (value) => {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((entry) => Number(entry)).filter((entry) => Number.isFinite(entry) && entry > 0))];
};

const toDateString = (input, fallback = null) => {
  if (!input) return fallback;
  const raw = String(input).trim();
  if (!raw) return fallback;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed.toISOString().slice(0, 10);
};

const LEVEL_ORDER = ['rashtriya', 'prant', 'sambhag', 'vibhag', 'jila', 'khand', 'nagar', 'mandal_basti', 'nagar_mohalla'];
const getLevelIndex = (level) => LEVEL_ORDER.indexOf(String(level || '').trim().toLowerCase());

const normalizeInvitationStatus = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return ['accepted', 'rejected', 'tentative'].includes(normalized) ? normalized : null;
};

exports.getVersions = async (req, res) => {
  try {
    const versions = await KaryakariniModel.getVersions();
    return res.status(200).json({
      success: true,
      data: {
        versions,
      },
    });
  } catch (error) {
    console.error('Failed to load versions:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load karyakarini versions',
    });
  }
};

exports.createVersion = async (req, res) => {
  try {
    const { name, startYear, endYear, isCurrent } = req.body || {};
    if (!name || !String(name).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Version name is required',
      });
    }

    const created = await KaryakariniModel.createVersion({
      name: String(name).trim(),
      startYear: parsePositiveNumber(startYear),
      endYear: parsePositiveNumber(endYear),
      isCurrent: Boolean(isCurrent),
      createdBy: req.user?.id || null,
    });

    return res.status(201).json({
      success: true,
      message: 'Version created successfully',
      data: created,
    });
  } catch (error) {
    console.error('Failed to create version:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create version',
    });
  }
};

exports.getTree = async (req, res) => {
  try {
    const versionInput = req.query.versionId || req.query.version || 'current';
    const versionId = await KaryakariniModel.resolveVersionId(versionInput);
    if (!versionId) {
      return res.status(404).json({
        success: false,
        message: 'No karyakarini version found',
      });
    }

    const parentId = req.query.parentId ? parsePositiveNumber(req.query.parentId) : null;
    const nodes = await KaryakariniModel.getNodesByParent(versionId, parentId);

    const userRole = normalizeRole(req.userRole || req.user?.role);
    let assignableSet = new Set();
    if (isAdminRole(userRole)) {
      const ids = await KaryakariniModel.getAssignableNodeIds(req.user?.id, versionId);
      assignableSet = new Set(ids.map((id) => Number(id)));
    }

    const nodesWithActions = nodes.map((node) => ({
      ...node,
      can_assign_member:
        userRole === 'superadmin' ||
        (isAdminRole(userRole) && assignableSet.has(Number(node.id))),
    }));

    let breadcrumb = [];
    if (parentId) {
      breadcrumb = await KaryakariniModel.getNodeBreadcrumb(parentId, versionId);
    }

    return res.status(200).json({
      success: true,
      data: {
        versionId,
        parentId,
        breadcrumb,
        nodes: nodesWithActions,
      },
    });
  } catch (error) {
    console.error('Failed to load tree:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load karyakarini tree',
    });
  }
};

exports.createNode = async (req, res) => {
  try {
    const { name, level, parentId, versionId: inputVersionId, sortOrder, metadata } = req.body || {};
    if (!name || !level) {
      return res.status(400).json({
        success: false,
        message: 'name and level are required',
      });
    }

    const versionId = await KaryakariniModel.resolveVersionId(inputVersionId || 'current');
    if (!versionId) {
      return res.status(404).json({
        success: false,
        message: 'Version not found',
      });
    }

    const normalizedParentId = parsePositiveNumber(parentId);
    const userRole = normalizeRole(req.userRole || req.user?.role);
    if (userRole !== 'superadmin') {
      if (!normalizedParentId) {
        return res.status(403).json({
          success: false,
          message: 'Only superadmin can create root nodes',
        });
      }
      const hasAccess = await KaryakariniModel.hasNodeAccess({
        nodeId: normalizedParentId,
        userId: req.user?.id,
        userRole,
        versionId,
      });
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'You can only add nodes under assigned scope',
        });
      }
    }

    const created = await KaryakariniModel.createNode({
      name: String(name).trim(),
      level: String(level).trim().toLowerCase(),
      parentId: normalizedParentId,
      versionId,
      sortOrder: Number(sortOrder || 0),
      metadata: metadata && typeof metadata === 'object' ? metadata : {},
      createdBy: req.user?.id || null,
    });

    return res.status(201).json({
      success: true,
      message: 'Node created successfully',
      data: created,
    });
  } catch (error) {
    console.error('Failed to create node:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create node',
    });
  }
};

exports.updateNode = async (req, res) => {
  try {
    const nodeId = parsePositiveNumber(req.params.nodeId);
    if (!nodeId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid node id',
      });
    }

    const versionId = await KaryakariniModel.resolveVersionId(req.body?.versionId || req.query?.versionId || 'current');
    if (!versionId) {
      return res.status(404).json({
        success: false,
        message: 'Version not found',
      });
    }

    const userRole = normalizeRole(req.userRole || req.user?.role);
    if (userRole !== 'superadmin') {
      const hasAccess = await KaryakariniModel.hasNodeAccess({
        nodeId,
        userId: req.user?.id,
        userRole,
        versionId,
      });
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'You can only edit nodes from assigned scope',
        });
      }
    }

    const payload = {};
    if (req.body?.name !== undefined) payload.name = String(req.body.name).trim();
    if (req.body?.level !== undefined) payload.level = String(req.body.level).trim().toLowerCase();
    if (req.body?.parentId !== undefined) payload.parent_id = parsePositiveNumber(req.body.parentId);
    if (req.body?.sortOrder !== undefined) payload.sort_order = Number(req.body.sortOrder || 0);
    if (req.body?.metadata !== undefined) payload.metadata = req.body.metadata && typeof req.body.metadata === 'object' ? req.body.metadata : {};

    const updated = await KaryakariniModel.updateNode(nodeId, versionId, payload);
    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Node not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Node updated successfully',
      data: updated,
    });
  } catch (error) {
    console.error('Failed to update node:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update node',
    });
  }
};

exports.getMembers = async (req, res) => {
  try {
    const nodeId = parsePositiveNumber(req.query.nodeId);
    if (!nodeId) {
      return res.status(400).json({
        success: false,
        message: 'nodeId is required',
      });
    }

    const versionId = await KaryakariniModel.resolveVersionId(req.query.versionId || req.query.version || 'current');
    if (!versionId) {
      return res.status(404).json({
        success: false,
        message: 'Version not found',
      });
    }

    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);

    const result = await KaryakariniModel.getMembersByNode({
      nodeId,
      versionId,
      page,
      limit,
    });

    return res.status(200).json({
      success: true,
      data: {
        nodeId,
        versionId,
        members: result.rows,
        pagination: result.pagination,
      },
    });
  } catch (error) {
    console.error('Failed to get members:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get members',
    });
  }
};

exports.searchUsers = async (req, res) => {
  try {
    const query = String(req.query.q || req.query.query || '').trim();
    if (!query || query.length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 3 characters',
      });
    }

    const rows = await KaryakariniModel.searchUsersForAssignment({
      query,
      limit: Number(req.query.limit || 12),
    });

    return res.status(200).json({
      success: true,
      data: {
        users: rows,
      },
    });
  } catch (error) {
    console.error('Failed to search users for assignment:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to search users',
    });
  }
};

exports.getPadOptions = async (req, res) => {
  try {
    const versionId = await KaryakariniModel.resolveVersionId(req.query.versionId || req.query.version || 'current');
    if (!versionId) {
      return res.status(404).json({
        success: false,
        message: 'Version not found',
      });
    }

    const pads = await KaryakariniModel.getMadhyaPradeshPads({ versionId });
    return res.status(200).json({
      success: true,
      data: {
        versionId,
        pads,
      },
    });
  } catch (error) {
    console.error('Failed to load pad options:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load pad options',
    });
  }
};

exports.getAssignableNodes = async (req, res) => {
  try {
    const versionId = await KaryakariniModel.resolveVersionId(req.query.versionId || req.query.version || 'current');
    if (!versionId) {
      return res.status(404).json({
        success: false,
        message: 'Version not found',
      });
    }

    const userRole = normalizeRole(req.userRole || req.user?.role);
    const nodes = await KaryakariniModel.getAssignableNodesForUser({
      userId: req.user?.id,
      userRole,
      versionId,
    });

    return res.status(200).json({
      success: true,
      data: {
        versionId,
        nodes,
      },
    });
  } catch (error) {
    console.error('Failed to load assignable nodes:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load assignable nodes',
    });
  }
};

exports.getNodeMembersDirect = async (req, res) => {
  try {
    const nodeId = parsePositiveNumber(req.query.nodeId);
    if (!nodeId) {
      return res.status(400).json({
        success: false,
        message: 'nodeId is required',
      });
    }

    const versionId = await KaryakariniModel.resolveVersionId(req.query.versionId || req.query.version || 'current');
    if (!versionId) {
      return res.status(404).json({
        success: false,
        message: 'Version not found',
      });
    }

    const userRole = normalizeRole(req.userRole || req.user?.role);
    const hasAccess = await KaryakariniModel.hasNodeAccess({
      nodeId,
      userId: req.user?.id,
      userRole,
      versionId,
    });
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'You can view members only in assigned scope',
      });
    }

    const members = await KaryakariniModel.getNodeMembersDirect({
      nodeId,
      versionId,
    });

    return res.status(200).json({
      success: true,
      data: {
        nodeId,
        versionId,
        members,
      },
    });
  } catch (error) {
    console.error('Failed to load node members:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load node members',
    });
  }
};

exports.searchGuests = async (req, res) => {
  try {
    const nodeId = parsePositiveNumber(req.query.nodeId);
    if (!nodeId) {
      return res.status(400).json({
        success: false,
        message: 'nodeId is required',
      });
    }

    const versionId = await KaryakariniModel.resolveVersionId(req.query.versionId || req.query.version || 'current');
    if (!versionId) {
      return res.status(404).json({
        success: false,
        message: 'Version not found',
      });
    }

    const userRole = normalizeRole(req.userRole || req.user?.role);
    const hasAccess = await KaryakariniModel.hasNodeAccess({
      nodeId,
      userId: req.user?.id,
      userRole,
      versionId,
    });
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'You can view guests only in assigned scope',
      });
    }

    const guests = await KaryakariniModel.searchGuestsForNode({
      nodeId,
      versionId,
      query: req.query.q || req.query.query || '',
      limit: Number(req.query.limit || 20),
    });

    return res.status(200).json({
      success: true,
      data: {
        nodeId,
        versionId,
        guests,
      },
    });
  } catch (error) {
    console.error('Failed to search guests:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to search guests',
    });
  }
};

exports.createGuest = async (req, res) => {
  try {
    const nodeId = parsePositiveNumber(req.body?.nodeId);
    if (!nodeId) {
      return res.status(400).json({
        success: false,
        message: 'nodeId is required',
      });
    }
    if (!req.body?.name || !String(req.body.name).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Guest name is required',
      });
    }

    const versionId = await KaryakariniModel.resolveVersionId(req.body?.versionId || req.body?.version || 'current');
    if (!versionId) {
      return res.status(404).json({
        success: false,
        message: 'Version not found',
      });
    }

    const userRole = normalizeRole(req.userRole || req.user?.role);
    const hasAccess = await KaryakariniModel.hasNodeAccess({
      nodeId,
      userId: req.user?.id,
      userRole,
      versionId,
    });
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'You can create guests only in assigned scope',
      });
    }

    const result = await KaryakariniModel.createGuestMember({
      nodeId,
      versionId,
      name: String(req.body.name || '').trim(),
      mobile: req.body.mobile ? String(req.body.mobile).trim() : null,
      email: req.body.email ? String(req.body.email).trim() : null,
      createdBy: req.user?.id || null,
    });

    return res.status(result.status === 'created' ? 201 : 200).json({
      success: true,
      message: result.status === 'created' ? 'Guest created' : 'Guest already exists',
      data: result,
    });
  } catch (error) {
    console.error('Failed to create guest:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create guest',
    });
  }
};

exports.createMeeting = async (req, res) => {
  try {
    const nodeId = parsePositiveNumber(req.body?.nodeId);
    if (!nodeId) {
      return res.status(400).json({
        success: false,
        message: 'nodeId is required',
      });
    }
    if (!req.body?.title || !String(req.body.title).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Meeting title is required',
      });
    }

    const versionId = await KaryakariniModel.resolveVersionId(req.body?.versionId || req.body?.version || 'current');
    if (!versionId) {
      return res.status(404).json({
        success: false,
        message: 'Version not found',
      });
    }

    const userRole = normalizeRole(req.userRole || req.user?.role);
    const hasAccess = await KaryakariniModel.hasNodeAccess({
      nodeId,
      userId: req.user?.id,
      userRole,
      versionId,
    });
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'You can create meetings only in assigned scope',
      });
    }

    const created = await KaryakariniModel.createMeeting({
      nodeId,
      versionId,
      title: String(req.body.title || '').trim(),
      description: req.body.description ? String(req.body.description) : null,
      meetingDate: toDateString(req.body.meetingDate || req.body.date, new Date().toISOString().slice(0, 10)),
      attendeeUserIds: parseNumberArray(req.body.attendeeUserIds),
      invitedUserIds: parseNumberArray(req.body.invitedUserIds),
      guestIds: parseNumberArray(req.body.guestIds),
      newGuests: Array.isArray(req.body.newGuests) ? req.body.newGuests : [],
      attachments: Array.isArray(req.body.attachments) ? req.body.attachments : [],
      createdBy: req.user?.id || null,
    });

    const newlyInvitedUserIds = Array.isArray(created?.newly_invited_user_ids) ? created.newly_invited_user_ids : [];
    await Promise.all(
      newlyInvitedUserIds.map((invitedUserId) =>
        ablyService.publishNotification(invitedUserId, {
          type: 'meeting-invitation',
          title: 'Karyakarini meeting invitation',
          message: `${String(req.body.title || '').trim()} on ${toDateString(req.body.meetingDate || req.body.date, '')}`,
          meetingId: Number(created?.id || 0),
          versionId,
          invitationStatus: 'pending',
        })
      )
    );

    return res.status(201).json({
      success: true,
      message: 'Meeting created successfully',
      data: created,
    });
  } catch (error) {
    console.error('Failed to create meeting:', error);
    return res.status(500).json({
      success: false,
      message: error?.message || 'Failed to create meeting',
    });
  }
};

exports.getMeetings = async (req, res) => {
  try {
    const versionId = await KaryakariniModel.resolveVersionId(req.query.versionId || req.query.version || 'current');
    if (!versionId) {
      return res.status(404).json({
        success: false,
        message: 'Version not found',
      });
    }

    const userRole = normalizeRole(req.userRole || req.user?.role);
    const visibleNodeIds = await KaryakariniModel.getVisibleNodeIdsForUser({
      userId: req.user?.id,
      userRole,
      versionId,
    });

    const result = await KaryakariniModel.getMeetings({
      versionId,
      visibleNodeIds,
      nodeId: parsePositiveNumber(req.query.nodeId),
      page: Number(req.query.page || 1),
      limit: Number(req.query.limit || 20),
    });

    return res.status(200).json({
      success: true,
      data: {
        versionId,
        meetings: result.rows,
        pagination: result.pagination,
      },
    });
  } catch (error) {
    console.error('Failed to load meetings:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load meetings',
    });
  }
};

exports.getMeetingDetails = async (req, res) => {
  try {
    const meetingId = parsePositiveNumber(req.params.meetingId);
    if (!meetingId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid meeting id',
      });
    }

    const versionId = await KaryakariniModel.resolveVersionId(req.query.versionId || req.query.version || 'current');
    if (!versionId) {
      return res.status(404).json({
        success: false,
        message: 'Version not found',
      });
    }

    const userRole = normalizeRole(req.userRole || req.user?.role);
    const visibleNodeIds = await KaryakariniModel.getVisibleNodeIdsForUser({
      userId: req.user?.id,
      userRole,
      versionId,
    });

    const details = await KaryakariniModel.getMeetingDetails({
      meetingId,
      versionId,
      visibleNodeIds,
    });
    if (!details) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        versionId,
        meeting: details,
      },
    });
  } catch (error) {
    console.error('Failed to load meeting details:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load meeting details',
    });
  }
};

exports.updateMeeting = async (req, res) => {
  try {
    const meetingId = parsePositiveNumber(req.params.meetingId);
    if (!meetingId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid meeting id',
      });
    }

    const versionId = await KaryakariniModel.resolveVersionId(req.body?.versionId || req.body?.version || req.query.versionId || req.query.version || 'current');
    if (!versionId) {
      return res.status(404).json({
        success: false,
        message: 'Version not found',
      });
    }

    const userRole = normalizeRole(req.userRole || req.user?.role);
    const visibleNodeIds = await KaryakariniModel.getVisibleNodeIdsForUser({
      userId: req.user?.id,
      userRole,
      versionId,
    });

    const existing = await KaryakariniModel.getMeetingDetails({
      meetingId,
      versionId,
      visibleNodeIds,
    });
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found',
      });
    }

    const nodeId = parsePositiveNumber(req.body?.nodeId) || Number(existing.node_id);
    const hasAccess = await KaryakariniModel.hasNodeAccess({
      nodeId,
      userId: req.user?.id,
      userRole,
      versionId,
    });
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'You can update meetings only in assigned scope',
      });
    }

    const title = String(req.body?.title || existing.title || '').trim();
    if (!title) {
      return res.status(400).json({
        success: false,
        message: 'Meeting title is required',
      });
    }

    const updatedMeeting = await KaryakariniModel.updateMeeting({
      meetingId,
      versionId,
      nodeId,
      title,
      description: req.body?.description !== undefined ? req.body.description : existing.description,
      meetingDate: toDateString(req.body?.meetingDate || req.body?.date, existing.meeting_date || new Date().toISOString().slice(0, 10)),
      attendeeUserIds: req.body?.attendeeUserIds !== undefined ? parseNumberArray(req.body.attendeeUserIds) : existing.attendeeUserIds,
      invitedUserIds: req.body?.invitedUserIds !== undefined ? parseNumberArray(req.body.invitedUserIds) : existing.invitedUserIds,
      guestIds: req.body?.guestIds !== undefined ? parseNumberArray(req.body.guestIds) : existing.guestIds,
      newGuests: Array.isArray(req.body?.newGuests) ? req.body.newGuests : [],
      attachments: Array.isArray(req.body?.attachments) ? req.body.attachments : existing.attachments || [],
      updatedBy: req.user?.id || null,
    });

    const details = await KaryakariniModel.getMeetingDetails({
      meetingId,
      versionId,
      visibleNodeIds,
    });

    const newlyInvitedUserIds = Array.isArray(updatedMeeting?.newly_invited_user_ids) ? updatedMeeting.newly_invited_user_ids : [];
    await Promise.all(
      newlyInvitedUserIds.map((invitedUserId) =>
        ablyService.publishNotification(invitedUserId, {
          type: 'meeting-invitation',
          title: 'Karyakarini meeting invitation',
          message: `${title} on ${toDateString(req.body?.meetingDate || req.body?.date, details?.meeting_date || '')}`,
          meetingId: Number(meetingId),
          versionId,
          invitationStatus: 'pending',
        })
      )
    );

    return res.status(200).json({
      success: true,
      message: 'Meeting updated successfully',
      data: {
        versionId,
        meeting: details,
      },
    });
  } catch (error) {
    console.error('Failed to update meeting:', error);
    return res.status(500).json({
      success: false,
      message: error?.message || 'Failed to update meeting',
    });
  }
};

exports.createTask = async (req, res) => {
  try {
    const nodeId = parsePositiveNumber(req.body?.nodeId);
    if (!nodeId) {
      return res.status(400).json({
        success: false,
        message: 'nodeId is required',
      });
    }
    if (!req.body?.title || !String(req.body.title).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Task title is required',
      });
    }

    const versionId = await KaryakariniModel.resolveVersionId(req.body?.versionId || req.body?.version || 'current');
    if (!versionId) {
      return res.status(404).json({
        success: false,
        message: 'Version not found',
      });
    }

    const userRole = normalizeRole(req.userRole || req.user?.role);
    const hasAccess = await KaryakariniModel.hasNodeAccess({
      nodeId,
      userId: req.user?.id,
      userRole,
      versionId,
    });
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'You can create tasks only in assigned scope',
      });
    }

    const created = await KaryakariniModel.createTask({
      nodeId,
      versionId,
      title: String(req.body.title || '').trim(),
      description: req.body.description ? String(req.body.description) : null,
      taskDate: toDateString(req.body.taskDate || req.body.date, new Date().toISOString().slice(0, 10)),
      dueDate: toDateString(req.body.dueDate, null),
      status: req.body.status ? String(req.body.status) : 'open',
      assignedUserId: parsePositiveNumber(req.body.assignedUserId),
      attachments: Array.isArray(req.body.attachments) ? req.body.attachments : [],
      createdBy: req.user?.id || null,
    });

    return res.status(201).json({
      success: true,
      message: 'Task created successfully',
      data: created,
    });
  } catch (error) {
    console.error('Failed to create task:', error);
    return res.status(500).json({
      success: false,
      message: error?.message || 'Failed to create task',
    });
  }
};

exports.getTasks = async (req, res) => {
  try {
    const versionId = await KaryakariniModel.resolveVersionId(req.query.versionId || req.query.version || 'current');
    if (!versionId) {
      return res.status(404).json({
        success: false,
        message: 'Version not found',
      });
    }

    const userRole = normalizeRole(req.userRole || req.user?.role);
    const visibleNodeIds = await KaryakariniModel.getVisibleNodeIdsForUser({
      userId: req.user?.id,
      userRole,
      versionId,
    });

    const result = await KaryakariniModel.getTasks({
      versionId,
      visibleNodeIds,
      nodeId: parsePositiveNumber(req.query.nodeId),
      page: Number(req.query.page || 1),
      limit: Number(req.query.limit || 20),
    });

    return res.status(200).json({
      success: true,
      data: {
        versionId,
        tasks: result.rows,
        pagination: result.pagination,
      },
    });
  } catch (error) {
    console.error('Failed to load tasks:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load tasks',
    });
  }
};

exports.getMyTeams = async (req, res) => {
  try {
    const versionId = await KaryakariniModel.resolveVersionId(req.query.versionId || req.query.version || 'current');
    if (!versionId) {
      return res.status(404).json({
        success: false,
        message: 'Version not found',
      });
    }

    const teams = await KaryakariniModel.getMyTeamNodes({
      userId: req.user?.id,
      versionId,
    });

    return res.status(200).json({
      success: true,
      data: {
        versionId,
        teams,
      },
    });
  } catch (error) {
    console.error('Failed to load my karyakarini teams:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load my karyakarini teams',
    });
  }
};

exports.getMyInvitations = async (req, res) => {
  try {
    const versionId = await KaryakariniModel.resolveVersionId(req.query.versionId || req.query.version || 'current');
    if (!versionId) {
      return res.status(404).json({
        success: false,
        message: 'Version not found',
      });
    }

    const result = await KaryakariniModel.getUserInvitations({
      userId: req.user?.id,
      versionId,
      status: req.query.status,
      onlyUnread: String(req.query.onlyUnread || '').trim().toLowerCase() === 'true',
      page: Number(req.query.page || 1),
      limit: Number(req.query.limit || 20),
    });

    return res.status(200).json({
      success: true,
      data: {
        versionId,
        invitations: result.rows,
        pagination: result.pagination,
      },
    });
  } catch (error) {
    console.error('Failed to load my invitations:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load invitations',
    });
  }
};

exports.getMySentInvitationsSummary = async (req, res) => {
  try {
    const versionId = await KaryakariniModel.resolveVersionId(req.query.versionId || req.query.version || 'current');
    if (!versionId) {
      return res.status(404).json({
        success: false,
        message: 'Version not found',
      });
    }

    const result = await KaryakariniModel.getSentInvitationSummary({
      userId: req.user?.id,
      versionId,
      page: Number(req.query.page || 1),
      limit: Number(req.query.limit || 20),
    });

    return res.status(200).json({
      success: true,
      data: {
        versionId,
        sent: result.rows,
        pagination: result.pagination,
      },
    });
  } catch (error) {
    console.error('Failed to load sent invitation summary:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load sent invitation summary',
    });
  }
};

exports.markMyInvitationsRead = async (req, res) => {
  try {
    const markedCount = await KaryakariniModel.markUserInvitationsRead({
      userId: req.user?.id,
      invitationIds: parseNumberArray(req.body?.invitationIds),
    });

    return res.status(200).json({
      success: true,
      message: 'Invitations marked as read',
      data: {
        markedCount,
      },
    });
  } catch (error) {
    console.error('Failed to mark invitations read:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to mark invitations read',
    });
  }
};

exports.respondToInvitation = async (req, res) => {
  try {
    const invitationId = parsePositiveNumber(req.params.invitationId);
    if (!invitationId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid invitation id',
      });
    }

    const status = normalizeInvitationStatus(req.body?.status);
    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'status must be one of accepted, rejected, tentative',
      });
    }

    const updated = await KaryakariniModel.respondToMeetingInvitation({
      invitationId,
      userId: req.user?.id,
      status,
      responseNote: req.body?.responseNote || null,
    });
    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Invitation not found',
      });
    }

    if (Number(updated.invited_by) > 0 && Number(updated.invited_by) !== Number(req.user?.id)) {
      const responderName = [req.user?.first_name, req.user?.firstName, req.user?.name].find(Boolean) || `User #${req.user?.id}`;
      await ablyService.publishNotification(Number(updated.invited_by), {
        type: 'meeting-invitation-response',
        title: 'Invitation response received',
        message: `${responderName} marked ${updated.meeting_title || 'meeting'} as ${status}`,
        meetingId: Number(updated.meeting_id || 0),
        invitationId: Number(updated.id || 0),
        responseStatus: status,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Invitation response saved',
      data: {
        invitation: updated,
      },
    });
  } catch (error) {
    console.error('Failed to update invitation response:', error);
    return res.status(500).json({
      success: false,
      message: error?.message || 'Failed to update invitation response',
    });
  }
};

exports.getMyTasks = async (req, res) => {
  try {
    const versionId = await KaryakariniModel.resolveVersionId(req.query.versionId || req.query.version || 'current');
    if (!versionId) {
      return res.status(404).json({
        success: false,
        message: 'Version not found',
      });
    }

    const result = await KaryakariniModel.getTasksForUser({
      userId: req.user?.id,
      versionId,
      page: Number(req.query.page || 1),
      limit: Number(req.query.limit || 20),
    });

    return res.status(200).json({
      success: true,
      data: {
        versionId,
        tasks: result.rows,
        pagination: result.pagination,
      },
    });
  } catch (error) {
    console.error('Failed to load my tasks:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load my tasks',
    });
  }
};

exports.uploadAttachment = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No attachment file provided',
      });
    }

    const folder = String(req.body?.folder || 'karyakarini').trim().replace(/[^a-zA-Z0-9/_-]/g, '_');
    const category = String(req.body?.category || 'meeting-task').trim().replace(/[^a-zA-Z0-9/_-]/g, '_');
    const safeName = sanitizeFileName(req.file.originalname || 'attachment');
    const key = `${folder}/${category}/${Date.now()}-${safeName}`;

    const url = await uploadBufferToS3({
      buffer: req.file.buffer,
      key,
      contentType: req.file.mimetype || 'application/octet-stream',
    });

    return res.status(201).json({
      success: true,
      data: {
        url,
        key,
        fileName: req.file.originalname,
        fileType: req.file.mimetype,
        size: req.file.size,
      },
    });
  } catch (error) {
    console.error('Failed to upload karyakarini attachment:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to upload attachment',
    });
  }
};

exports.createMember = async (req, res) => {
  try {
    const {
      userId: rawUserId,
      mobileNumber,
      name,
      fatherOrHusbandName,
      avatar,
      pad,
      period,
      startDate,
      endDate,
      village,
      tehsil,
      district,
      state,
      pincode,
      category,
      subcategory,
      dob,
      gotra,
      password,
      nodeId: rawNodeId,
      versionId: rawVersionId,
    } = req.body || {};

    const nodeId = parsePositiveNumber(rawNodeId);
    const userId = parsePositiveNumber(rawUserId);
    const hasIdentity = Boolean(userId || (mobileNumber && name));
    if (!hasIdentity || !nodeId) {
      return res.status(400).json({
        success: false,
        message: 'nodeId and either userId or mobileNumber+name are required',
      });
    }

    const versionId = await KaryakariniModel.resolveVersionId(rawVersionId || 'current');
    if (!versionId) {
      return res.status(404).json({
        success: false,
        message: 'Version not found',
      });
    }

    const userRole = normalizeRole(req.userRole || req.user?.role);
    const hasAccess = await KaryakariniModel.hasNodeAccess({
      nodeId,
      userId: req.user?.id,
      userRole,
      versionId,
    });

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'You can add members only in assigned node and children',
      });
    }

    const created = await KaryakariniModel.createMappedMemberWithUser({
      userId,
      mobileNumber: mobileNumber ? String(mobileNumber).trim() : null,
      name: name ? String(name).trim() : null,
      fatherOrHusbandName: fatherOrHusbandName ? String(fatherOrHusbandName).trim() : null,
      avatar: avatar ? String(avatar).trim() : null,
      pad: pad ? String(pad).trim() : null,
      period: period ? String(period).trim() : null,
      startDate: startDate ? String(startDate).trim() : null,
      endDate: endDate ? String(endDate).trim() : null,
      village: village ? String(village).trim() : null,
      tehsil: tehsil ? String(tehsil).trim() : null,
      district: district ? String(district).trim() : null,
      state: state ? String(state).trim() : null,
      pincode: pincode ? String(pincode).trim() : null,
      category: category ? String(category).trim() : null,
      subcategory: subcategory ? String(subcategory).trim() : null,
      dob: dob ? String(dob).trim() : '1990-01-01',
      gotra: gotra ? String(gotra).trim() : 'Unknown',
      password: password ? String(password).trim() : null,
      nodeId,
      versionId,
      createdBy: req.user?.id || null,
    });

    if (created.status === 'skipped_existing_member') {
      return res.status(200).json({
        success: true,
        message: created.reason || 'Member already exists for this user',
        data: created,
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Member added successfully',
      data: created,
    });
  } catch (error) {
    console.error('Failed to create member:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create member',
    });
  }
};

exports.createMemberWithUserMapping = async (req, res) => {
  try {
    const {
      userId: rawUserId,
      mobileNumber,
      name,
      pad,
      period,
      startDate,
      endDate,
      village,
      tehsil,
      district,
      state,
      pincode,
      category,
      subcategory,
      nodeId: rawNodeId,
      versionId: rawVersionId,
      dob,
      gotra,
      password,
      fatherOrHusbandName,
      avatar,
    } = req.body || {};

    const nodeId = parsePositiveNumber(rawNodeId);
    const userId = parsePositiveNumber(rawUserId);
    const hasIdentity = Boolean(userId || (mobileNumber && name));
    if (!hasIdentity || !nodeId) {
      return res.status(400).json({
        success: false,
        message: 'nodeId and either userId or mobileNumber+name are required',
      });
    }

    const versionId = await KaryakariniModel.resolveVersionId(rawVersionId || 'current');
    if (!versionId) {
      return res.status(404).json({
        success: false,
        message: 'Version not found',
      });
    }

    const userRole = normalizeRole(req.userRole || req.user?.role);
    const hasAccess = await KaryakariniModel.hasNodeAccess({
      nodeId,
      userId: req.user?.id,
      userRole,
      versionId,
    });

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'You can add members only in assigned node and children',
      });
    }

    const result = await KaryakariniModel.createMappedMemberWithUser({
      userId,
      mobileNumber: mobileNumber ? String(mobileNumber).trim() : null,
      name: name ? String(name).trim() : null,
      pad: pad ? String(pad).trim() : null,
      period: period ? String(period).trim() : null,
      startDate: startDate ? String(startDate).trim() : null,
      endDate: endDate ? String(endDate).trim() : null,
      village: village ? String(village).trim() : null,
      tehsil: tehsil ? String(tehsil).trim() : null,
      district: district ? String(district).trim() : null,
      state: state ? String(state).trim() : null,
      pincode: pincode ? String(pincode).trim() : null,
      category: category ? String(category).trim() : null,
      subcategory: subcategory ? String(subcategory).trim() : null,
      nodeId,
      versionId,
      createdBy: req.user?.id || null,
      dob: dob ? String(dob).trim() : '1990-01-01',
      gotra: gotra ? String(gotra).trim() : 'Unknown',
      password: password ? String(password).trim() : null,
      fatherOrHusbandName: fatherOrHusbandName ? String(fatherOrHusbandName).trim() : 'Unknown',
      avatar: avatar ? String(avatar).trim() : null,
    });

    if (result.status === 'skipped_existing_member') {
      return res.status(200).json({
        success: true,
        message: result.reason,
        data: result,
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Member and user mapping created successfully',
      data: result,
    });
  } catch (error) {
    console.error('Failed to create mapped member:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create mapped member',
    });
  }
};

exports.upsertScope = async (req, res) => {
  try {
    const userId = parsePositiveNumber(req.body?.userId);
    const nodeId = parsePositiveNumber(req.body?.nodeId);
    if (!userId || !nodeId) {
      return res.status(400).json({
        success: false,
        message: 'userId and nodeId are required',
      });
    }

    const versionId = await KaryakariniModel.resolveVersionId(req.body?.versionId || 'current');
    if (!versionId) {
      return res.status(404).json({
        success: false,
        message: 'Version not found',
      });
    }

    const userRole = normalizeRole(req.userRole || req.user?.role);
    if (userRole !== 'superadmin') {
      const accessibleNodeIds = await KaryakariniModel.getAssignableNodeIds(req.user?.id, versionId);
      if (!accessibleNodeIds.includes(Number(nodeId))) {
        return res.status(403).json({
          success: false,
          message: 'You can assign admin role only within your node scope',
        });
      }

      const targetNode = await KaryakariniModel.getNodeById(nodeId, versionId);
      const targetLevelIndex = getLevelIndex(targetNode?.level);
      const scopeRoots = await KaryakariniModel.getScopeRootNodes({
        userId: req.user?.id,
        versionId,
      });
      const canAssignTargetLevel = scopeRoots.some((scopeRoot) => {
        const rootLevelIndex = getLevelIndex(scopeRoot.node_level);
        return rootLevelIndex >= 0 && targetLevelIndex > rootLevelIndex;
      });
      if (!canAssignTargetLevel) {
        return res.status(403).json({
          success: false,
          message: 'You can assign admin only to lower node levels under your assignment',
        });
      }
    }

    const updated = await KaryakariniModel.setAdminScope({
      userId,
      nodeId,
      versionId,
      isActive: req.body?.isActive !== false,
      createdBy: req.user?.id || null,
    });

    if (req.body?.isActive !== false) {
      await KaryakariniModel.promoteUserToAdminRole(userId);
    }

    return res.status(200).json({
      success: true,
      message: 'Scope updated successfully',
      data: updated,
    });
  } catch (error) {
    console.error('Failed to update scope:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update admin scope',
    });
  }
};

exports.getScopes = async (req, res) => {
  try {
    const userId = parsePositiveNumber(req.query.userId);
    const versionId = await KaryakariniModel.resolveVersionId(req.query.versionId || req.query.version || 'current');
    const userRole = normalizeRole(req.userRole || req.user?.role);
    if (userRole !== 'superadmin' && userId && Number(userId) !== Number(req.user?.id || 0)) {
      return res.status(403).json({
        success: false,
        message: 'You can only view your own scopes',
      });
    }

    const scopes = await KaryakariniModel.getAdminScopes({
      userId: userRole === 'superadmin' ? userId : req.user?.id,
      versionId,
    });

    return res.status(200).json({
      success: true,
      data: {
        versionId,
        scopes,
      },
    });
  } catch (error) {
    console.error('Failed to load scopes:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load admin scopes',
    });
  }
};
