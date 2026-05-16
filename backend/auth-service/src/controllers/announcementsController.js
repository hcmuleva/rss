const Announcement = require('../models/Announcement');
const ablyService = require('../services/ablyService');

const parsePositiveNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const getCategories = async (req, res) => {
  try {
    const categories = await Announcement.getCategorySummary();
    return res.status(200).json({
      success: true,
      data: {
        categories,
      },
    });
  } catch (error) {
    console.error('Get announcement categories error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load announcement categories',
    });
  }
};

const listAnnouncements = async (req, res) => {
  try {
    const category = String(req.query.category || '').trim().toLowerCase();
    const normalizedCategory = category && Announcement.isValidCategory(category) ? category : '';
    const result = await Announcement.listAnnouncements({
      category: normalizedCategory,
      page: Number(req.query.page || 1),
      limit: Number(req.query.limit || 20),
    });

    return res.status(200).json({
      success: true,
      data: {
        category: normalizedCategory || null,
        announcements: result.rows,
        pagination: result.pagination,
      },
    });
  } catch (error) {
    console.error('List announcements error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load announcements',
    });
  }
};

const createAnnouncement = async (req, res) => {
  try {
    const category = String(req.body?.category || '').trim().toLowerCase();
    const title = String(req.body?.title || '').trim();
    const message = String(req.body?.message || '').trim();

    if (!Announcement.isValidCategory(category)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid announcement category',
      });
    }
    if (!title || !message) {
      return res.status(400).json({
        success: false,
        message: 'title and message are required',
      });
    }

    const created = await Announcement.createAnnouncement({
      category,
      title,
      message,
      createdBy: req.user?.id || null,
    });

    const userIds = await Announcement.getAllActiveUserIds();
    await Promise.all(
      userIds.map((userId) =>
        ablyService.publishNotificationToBell(userId, {
          category: 'announcement',
          type: 'announcement-created',
          title,
          message: `${category.toUpperCase()} • ${message.slice(0, 120)}`,
          announcementId: Number(created.id),
          announcementCategory: category,
        })
      )
    );

    return res.status(201).json({
      success: true,
      message: 'Announcement created successfully',
      data: {
        announcement: created,
      },
    });
  } catch (error) {
    console.error('Create announcement error:', error);
    return res.status(500).json({
      success: false,
      message: error?.message || 'Failed to create announcement',
    });
  }
};

const listAnnouncementComments = async (req, res) => {
  try {
    const announcementId = parsePositiveNumber(req.params.announcementId);
    if (!announcementId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid announcement id',
      });
    }

    const result = await Announcement.listComments({
      announcementId,
      page: Number(req.query.page || 1),
      limit: Number(req.query.limit || 50),
    });

    return res.status(200).json({
      success: true,
      data: {
        announcementId,
        comments: result.rows,
        pagination: result.pagination,
      },
    });
  } catch (error) {
    console.error('List announcement comments error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load comments',
    });
  }
};

const createAnnouncementComment = async (req, res) => {
  try {
    const announcementId = parsePositiveNumber(req.params.announcementId);
    if (!announcementId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid announcement id',
      });
    }

    const comment = await Announcement.createComment({
      announcementId,
      userId: req.user?.id || null,
      commentText: req.body?.comment || req.body?.commentText || '',
    });

    return res.status(201).json({
      success: true,
      message: 'Comment added successfully',
      data: {
        comment,
      },
    });
  } catch (error) {
    console.error('Create announcement comment error:', error);
    return res.status(500).json({
      success: false,
      message: error?.message || 'Failed to add comment',
    });
  }
};

module.exports = {
  getCategories,
  listAnnouncements,
  createAnnouncement,
  listAnnouncementComments,
  createAnnouncementComment,
};
