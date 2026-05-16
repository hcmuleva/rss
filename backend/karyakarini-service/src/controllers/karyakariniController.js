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

const parseStringArray = (value) => {
  if (Array.isArray(value)) {
    return [...new Set(value.map((entry) => String(entry || '').trim().toLowerCase()).filter(Boolean))];
  }
  const raw = String(value || '').trim();
  if (!raw) return [];
  return [...new Set(raw.split(',').map((entry) => entry.trim().toLowerCase()).filter(Boolean))];
};

const parseMemberLabelList = (value, fallback = null) => {
  if (Array.isArray(value)) {
    return [...new Set(value.map((entry) => String(entry || '').trim()).filter(Boolean))];
  }
  const raw = String(value || '').trim();
  if (raw) {
    return [...new Set(raw.split(',').map((entry) => entry.trim()).filter(Boolean))];
  }
  const fallbackRaw = String(fallback || '').trim();
  return fallbackRaw ? [fallbackRaw] : [];
};

const normalizeMemberUserRole = (value) => (String(value || '').trim().toLowerCase() === 'admin' ? 'admin' : 'user');

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

const validateRequiredMemberFields = (payload = {}) => {
  const hasValue = (value) => {
    if (Array.isArray(value)) return value.map((entry) => String(entry || '').trim()).filter(Boolean).length > 0;
    return Boolean(String(value || '').trim());
  };
  const required = [
    ['pad', 'Pad'],
    ['category', 'Category'],
    ['subcategory', 'Subcategory'],
  ];
  const missing = required
    .filter(([key]) => !hasValue(payload[key]))
    .map(([, label]) => label);
  return missing.length ? `${missing.join(', ')} is required` : null;
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
    let scopeRootSet = new Set();
    if (isAdminRole(userRole)) {
      const ids = await KaryakariniModel.getAssignableNodeIds(req.user?.id, versionId);
      assignableSet = new Set(ids.map((id) => Number(id)));
      const scopeRoots = await KaryakariniModel.getScopeRootNodes({ userId: req.user?.id, versionId });
      scopeRootSet = new Set(scopeRoots.map((row) => Number(row.node_id)).filter((id) => Number.isFinite(id) && id > 0));
    }

    const nodesWithActions = nodes.map((node) => ({
      ...node,
      can_assign_member:
        userRole === 'superadmin' ||
        (isAdminRole(userRole) && assignableSet.has(Number(node.id)) && !scopeRootSet.has(Number(node.id))),
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

exports.updateMember = async (req, res) => {
  try {
    const memberId = parsePositiveNumber(req.params.memberId);
    if (!memberId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid member id',
      });
    }

    const versionId = await KaryakariniModel.resolveVersionId(req.body?.versionId || req.query?.versionId || 'current');
    if (!versionId) {
      return res.status(404).json({
        success: false,
        message: 'Version not found',
      });
    }

    const existing = await KaryakariniModel.getMemberById({
      memberId,
      versionId,
    });
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Member not found',
      });
    }

    const userRole = normalizeRole(req.userRole || req.user?.role);
    const hasAccess = await KaryakariniModel.hasNodeAccess({
      nodeId: Number(existing.node_id),
      userId: req.user?.id,
      userRole,
      versionId,
    });
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'You can edit members only in assigned node and children',
      });
    }

    const resolvedCategories = parseMemberLabelList(
      req.body?.categories !== undefined ? req.body.categories : existing.categories,
      req.body?.category !== undefined ? req.body.category : existing.category
    );
    const resolvedSubcategories = parseMemberLabelList(
      req.body?.subcategories !== undefined ? req.body.subcategories : existing.subcategories,
      req.body?.subcategory !== undefined ? req.body.subcategory : existing.subcategory
    );

    const memberValidationMessage = validateRequiredMemberFields({
      pad: req.body?.pad !== undefined ? req.body.pad : existing.pad,
      category: resolvedCategories,
      subcategory: resolvedSubcategories,
    });
    if (memberValidationMessage) {
      return res.status(400).json({
        success: false,
        message: memberValidationMessage,
      });
    }

    const updated = await KaryakariniModel.updateMember({
      memberId,
      versionId,
      name: req.body?.name,
      fatherOrHusbandName: req.body?.fatherOrHusbandName,
      mobileNumber: req.body?.mobileNumber,
      avatar: req.body?.avatar,
      pad: req.body?.pad,
      period: req.body?.period,
      startDate: req.body?.startDate,
      endDate: req.body?.endDate,
      village: req.body?.village,
      tehsil: req.body?.tehsil,
      district: req.body?.district,
      state: req.body?.state,
      pincode: req.body?.pincode,
      category: req.body?.category !== undefined ? req.body.category : resolvedCategories[0] || null,
      subcategory: req.body?.subcategory !== undefined ? req.body.subcategory : resolvedSubcategories[0] || null,
      categories: resolvedCategories,
      subcategories: resolvedSubcategories,
      userRole: req.body?.userRole !== undefined ? normalizeMemberUserRole(req.body.userRole) : undefined,
    });

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Member not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Member updated successfully',
      data: {
        versionId,
        member: updated,
      },
    });
  } catch (error) {
    console.error('Failed to update member:', error);
    return res.status(500).json({
      success: false,
      message: error?.message || 'Failed to update member',
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
    const taskCategories = parseMemberLabelList(req.body?.categories, req.body?.category);
    const taskSubcategories = parseMemberLabelList(req.body?.subcategories, req.body?.subcategory);
    if (!taskSubcategories.length) {
      return res.status(400).json({
        success: false,
        message: 'Task subcategory selection is required',
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
      includeSelf: false,
    });
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'You can create tasks only in child nodes under your assigned scope',
      });
    }

    const created = await KaryakariniModel.createTask({
      categories: taskCategories,
      subcategories: taskSubcategories,
      nodeId,
      versionId,
      title: String(req.body.title || '').trim(),
      description: req.body.description ? String(req.body.description) : null,
      taskDate: toDateString(req.body.taskDate || req.body.date, new Date().toISOString().slice(0, 10)),
      dueDate: toDateString(req.body.dueDate, null),
      status: req.body.status ? String(req.body.status) : 'open',
      locationHierarchy:
        req.body?.locationHierarchy && typeof req.body.locationHierarchy === 'object'
          ? req.body.locationHierarchy
          : {
              l1: req.body?.hierarchyL1,
              l2: req.body?.hierarchyL2,
              l3: req.body?.hierarchyL3,
              l4: req.body?.hierarchyL4,
              l5: req.body?.hierarchyL5,
              l5Sublevels: req.body?.hierarchyL5Sublevels,
            },
      assignedUserId: parsePositiveNumber(req.body.assignedUserId),
      attachments: Array.isArray(req.body.attachments) ? req.body.attachments : [],
      createdBy: req.user?.id || null,
    });

    const assignedUserId = Number(created?.assigned_user_id || 0);
    if (assignedUserId > 0) {
      const hierarchyLabel = [created?.hierarchy_l1, created?.hierarchy_l2, created?.hierarchy_l3, created?.hierarchy_l4, created?.hierarchy_l5]
        .filter(Boolean)
        .join(' > ');
      const subcategoryLabel = Array.isArray(created?.task_subcategories)
        ? created.task_subcategories.map((entry) => String(entry || '').trim()).filter(Boolean).join(', ')
        : '';
      const taskTitle = String(created?.title || req.body.title || 'Task').trim();
      const message = [taskTitle, hierarchyLabel, subcategoryLabel].filter(Boolean).join(' • ');
      await KaryakariniModel.createNotification({
        userId: assignedUserId,
        versionId,
        category: 'tasks',
        type: 'task-assigned',
        title: 'New task assigned',
        message,
        entityType: 'task',
        entityId: Number(created?.id || 0),
        metadata: {
          taskStatus: String(created?.status || 'open'),
          taskDate: created?.task_date || null,
          dueDate: created?.due_date || null,
          taskCategories: created?.task_categories || [],
          taskSubcategories: created?.task_subcategories || [],
        },
      });
      await ablyService.publishNotification(assignedUserId, {
        type: 'task-assigned',
        title: 'New task assigned',
        message,
        taskId: Number(created?.id || 0),
        versionId,
        taskStatus: String(created?.status || 'open'),
      });
    }

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
      hierarchy: {
        l1: req.query.hierarchyL1,
        l2: req.query.hierarchyL2,
        l3: req.query.hierarchyL3,
        l4: req.query.hierarchyL4,
        l5: req.query.hierarchyL5,
        hierarchySublevel: req.query.hierarchySublevel,
      },
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

exports.createMyCategoryActivity = async (req, res) => {
  try {
    const versionId = await KaryakariniModel.resolveVersionId(req.body?.versionId || req.query?.versionId || 'current');
    if (!versionId) {
      return res.status(404).json({
        success: false,
        message: 'Version not found',
      });
    }

    const nodeId = parsePositiveNumber(req.body?.nodeId);
    const title = String(req.body?.title || '').trim();
    const subcategory = String(req.body?.subcategory || '').trim();
    if (!nodeId || !title || !subcategory) {
      return res.status(400).json({
        success: false,
        message: 'nodeId, title, and subcategory are required',
      });
    }

    const visibleNodeIds = await KaryakariniModel.getMemberVisibleNodeIds({
      userId: req.user?.id,
      versionId,
    });
    if (!visibleNodeIds.includes(Number(nodeId))) {
      return res.status(403).json({
        success: false,
        message: 'You can submit activity only within your assigned node scope',
      });
    }

    const created = await KaryakariniModel.createCategoryActivity({
      versionId,
      nodeId,
      submittedBy: req.user?.id,
      category: req.body?.category ? String(req.body.category).trim() : null,
      subcategory,
      title,
      description: req.body?.description ? String(req.body.description).trim() : null,
      attachments: Array.isArray(req.body?.attachments) ? req.body.attachments : [],
    });

    return res.status(201).json({
      success: true,
      message: 'Category activity submitted successfully',
      data: created,
    });
  } catch (error) {
    console.error('Failed to submit category activity:', error);
    return res.status(500).json({
      success: false,
      message: error?.message || 'Failed to submit category activity',
    });
  }
};

exports.getCategoryActivities = async (req, res) => {
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

    const result = await KaryakariniModel.getCategoryActivities({
      versionId,
      visibleNodeIds,
      page: Number(req.query.page || 1),
      limit: Number(req.query.limit || 20),
      category: String(req.query.category || ''),
      subcategory: String(req.query.subcategory || ''),
      nodeLevel: String(req.query.nodeLevel || req.query.level || ''),
    });

    return res.status(200).json({
      success: true,
      data: {
        versionId,
        activities: result.rows,
        pagination: result.pagination,
      },
    });
  } catch (error) {
    console.error('Failed to load category activities:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load category activities',
    });
  }
};

exports.getMyCategoryActivities = async (req, res) => {
  try {
    const versionId = await KaryakariniModel.resolveVersionId(req.query.versionId || req.query.version || 'current');
    if (!versionId) {
      return res.status(404).json({
        success: false,
        message: 'Version not found',
      });
    }

    const visibleNodeIds = await KaryakariniModel.getMemberVisibleNodeIds({
      userId: req.user?.id,
      versionId,
    });

    const result = await KaryakariniModel.getCategoryActivities({
      versionId,
      visibleNodeIds,
      page: Number(req.query.page || 1),
      limit: Number(req.query.limit || 20),
      category: String(req.query.category || ''),
      subcategory: String(req.query.subcategory || ''),
      nodeLevel: String(req.query.nodeLevel || req.query.level || ''),
      submittedBy: req.user?.id,
    });

    return res.status(200).json({
      success: true,
      data: {
        versionId,
        activities: result.rows,
        pagination: result.pagination,
      },
    });
  } catch (error) {
    console.error('Failed to load my category activities:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load my category activities',
    });
  }
};

exports.getReportMembers = async (req, res) => {
  try {
    const versionId = await KaryakariniModel.resolveVersionId(req.query.versionId || req.query.version || 'current');
    if (!versionId) {
      return res.status(404).json({
        success: false,
        message: 'Version not found',
      });
    }

    const userRole = normalizeRole(req.userRole || req.user?.role);
    const adminVisibleNodeIds = await KaryakariniModel.getVisibleNodeIdsForUser({
      userId: req.user?.id,
      userRole,
      versionId,
    });
    const memberVisibleNodeIds = await KaryakariniModel.getMemberVisibleNodeIds({
      userId: req.user?.id,
      versionId,
    });
    const visibleNodeIds = [...new Set([...(adminVisibleNodeIds || []), ...(memberVisibleNodeIds || [])])];

    const result = await KaryakariniModel.getReportMembers({
      versionId,
      visibleNodeIds,
      page: Number(req.query.page || 1),
      limit: Number(req.query.limit || 20),
      category: String(req.query.category || ''),
      subcategory: String(req.query.subcategory || ''),
      nodeLevel: String(req.query.nodeLevel || req.query.level || ''),
      pad: String(req.query.pad || ''),
      query: String(req.query.query || ''),
    });

    return res.status(200).json({
      success: true,
      data: {
        versionId,
        members: result.rows,
        pagination: result.pagination,
      },
    });
  } catch (error) {
    console.error('Failed to load report members:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load report members',
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
      statuses: parseStringArray(req.query.statuses || req.query.status),
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

exports.updateMyTaskStatus = async (req, res) => {
  try {
    const taskId = parsePositiveNumber(req.params.taskId);
    if (!taskId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid task id',
      });
    }

    const status = String(req.body?.status || '').trim().toLowerCase();
    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'status is required',
      });
    }

    const versionId = await KaryakariniModel.resolveVersionId(req.body?.versionId || req.query?.versionId || 'current');
    if (!versionId) {
      return res.status(404).json({
        success: false,
        message: 'Version not found',
      });
    }

    const attachments = Array.isArray(req.body?.attachments) ? req.body.attachments : [];

    const updated = await KaryakariniModel.updateTaskStatus({
      taskId,
      userId: req.user?.id,
      userRole: normalizeRole(req.userRole || req.user?.role),
      versionId,
      status,
      attachments,
    });
    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Task not found',
      });
    }

    const actorName = [req.user?.first_name, req.user?.firstName, req.user?.name].find(Boolean) || `User #${req.user?.id}`;
    const notificationTitle = `Task marked ${String(updated.status || status).replace(/_/g, ' ')}`;
    const notificationMessage = `${actorName}: ${updated.title || `Task #${updated.id}`}`;

    const receivers = [Number(updated.created_by || 0), Number(updated.assigned_user_id || 0)]
      .filter((id) => id > 0 && id !== Number(req.user?.id || 0));
    await Promise.all(
      receivers.map(async (receiverId) => {
        await KaryakariniModel.createNotification({
          userId: receiverId,
          versionId,
          category: 'tasks',
          type: 'task-status-updated',
          title: notificationTitle,
          message: notificationMessage,
          entityType: 'task',
          entityId: Number(updated.id || 0),
          metadata: {
            taskStatus: String(updated.status || status),
            taskDate: updated.task_date || null,
            dueDate: updated.due_date || null,
          },
        });
        await ablyService.publishNotification(receiverId, {
          type: 'task-status-updated',
          title: notificationTitle,
          message: notificationMessage,
          taskId: Number(updated.id || 0),
          versionId,
          taskStatus: String(updated.status || status),
        });
      })
    );

    return res.status(200).json({
      success: true,
      message: 'Task status updated successfully',
      data: {
        versionId,
        task: updated,
      },
    });
  } catch (error) {
    const message = error?.message || 'Failed to update task status';
    const statusCode = /status must be/.test(message) ? 400 : /scope|assigned/.test(message) ? 403 : 500;
    return res.status(statusCode).json({
      success: false,
      message,
    });
  }
};

exports.getMyNotificationUnreadCount = async (req, res) => {
  try {
    const versionId = await KaryakariniModel.resolveVersionId(req.query.versionId || req.query.version || 'current');
    if (!versionId) {
      return res.status(404).json({
        success: false,
        message: 'Version not found',
      });
    }

    const counts = await KaryakariniModel.getUnreadNotificationCount({
      userId: req.user?.id,
      versionId,
    });

    return res.status(200).json({
      success: true,
      data: {
        versionId,
        ...counts,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to load unread notification count',
    });
  }
};

exports.getMyNotifications = async (req, res) => {
  try {
    const versionId = await KaryakariniModel.resolveVersionId(req.query.versionId || req.query.version || 'current');
    if (!versionId) {
      return res.status(404).json({
        success: false,
        message: 'Version not found',
      });
    }

    const result = await KaryakariniModel.getNotificationFeed({
      userId: req.user?.id,
      versionId,
      category: req.query.category || 'all',
      onlyUnread: String(req.query.onlyUnread || '').trim().toLowerCase() === 'true',
      page: Number(req.query.page || 1),
      limit: Number(req.query.limit || 20),
    });

    return res.status(200).json({
      success: true,
      data: {
        versionId,
        notifications: result.rows,
        pagination: result.pagination,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to load notifications',
    });
  }
};

exports.markMyNotificationsRead = async (req, res) => {
  try {
    const result = await KaryakariniModel.markNotificationsRead({
      userId: req.user?.id,
      notificationIds: parseNumberArray(req.body?.notificationIds),
      invitationIds: parseNumberArray(req.body?.invitationIds),
    });

    return res.status(200).json({
      success: true,
      message: 'Notifications marked as read',
      data: result,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to mark notifications read',
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
    const memberUserRole = normalizeMemberUserRole(req.body?.userRole);
    const categories = parseMemberLabelList(req.body?.categories, category);
    const subcategories = parseMemberLabelList(req.body?.subcategories, subcategory);
    const hasIdentity = Boolean(userId || (mobileNumber && name));
    if (!hasIdentity || !nodeId) {
      return res.status(400).json({
        success: false,
        message: 'nodeId and either userId or mobileNumber+name are required',
      });
    }
    const memberValidationMessage = validateRequiredMemberFields({
      pad,
      category: categories,
      subcategory: subcategories,
      state,
      district,
      tehsil,
      village,
      pincode,
    });
    if (memberValidationMessage) {
      return res.status(400).json({
        success: false,
        message: memberValidationMessage,
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
      includeSelf: false,
    });

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'You can add members only in child nodes under your assigned scope',
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
      category: categories[0] || (category ? String(category).trim() : null),
      subcategory: subcategories[0] || (subcategory ? String(subcategory).trim() : null),
      categories,
      subcategories,
      dob: dob ? String(dob).trim() : '1990-01-01',
      gotra: gotra ? String(gotra).trim() : 'Unknown',
      password: password ? String(password).trim() : null,
      nodeId,
      versionId,
      createdBy: req.user?.id || null,
      userRole: memberUserRole,
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
    const memberUserRole = normalizeMemberUserRole(req.body?.userRole);
    const categories = parseMemberLabelList(req.body?.categories, category);
    const subcategories = parseMemberLabelList(req.body?.subcategories, subcategory);
    const hasIdentity = Boolean(userId || (mobileNumber && name));
    if (!hasIdentity || !nodeId) {
      return res.status(400).json({
        success: false,
        message: 'nodeId and either userId or mobileNumber+name are required',
      });
    }
    const memberValidationMessage = validateRequiredMemberFields({
      pad,
      category: categories,
      subcategory: subcategories,
      state,
      district,
      tehsil,
      village,
      pincode,
    });
    if (memberValidationMessage) {
      return res.status(400).json({
        success: false,
        message: memberValidationMessage,
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
      includeSelf: false,
    });

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'You can add members only in child nodes under your assigned scope',
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
      category: categories[0] || (category ? String(category).trim() : null),
      subcategory: subcategories[0] || (subcategory ? String(subcategory).trim() : null),
      categories,
      subcategories,
      nodeId,
      versionId,
      createdBy: req.user?.id || null,
      dob: dob ? String(dob).trim() : '1990-01-01',
      gotra: gotra ? String(gotra).trim() : 'Unknown',
      password: password ? String(password).trim() : null,
      fatherOrHusbandName: fatherOrHusbandName ? String(fatherOrHusbandName).trim() : 'Unknown',
      avatar: avatar ? String(avatar).trim() : null,
      userRole: memberUserRole,
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
