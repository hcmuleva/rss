/**
 * =====================================================================
 * Quiz Controller
 * Company: emeelan
 * =====================================================================
 * Manages quiz activities, categories, questions, and video shares
 */

const pool = require('../config/database');

/**
 * Get all activities for an occurrence
 */
exports.getOccurrenceActivities = async (req, res) => {
  try {
    const { occurrenceId } = req.params;

    const result = await pool.query(
      `SELECT a.*, 
              CONCAT(u.first_name, ' ', u.last_name) as creator_name,
              (SELECT COUNT(*) FROM quiz_categories WHERE activity_id = a.id AND is_active = true) as category_count,
              (SELECT COUNT(*) FROM quiz_questions q 
               JOIN quiz_categories c ON q.category_id = c.id 
               WHERE c.activity_id = a.id AND q.is_active = true) as total_questions
       FROM event_activities a
       LEFT JOIN users u ON a.created_by = u.id
       WHERE a.occurrence_id = $1 AND a.is_active = true
       ORDER BY a.sequence_order, a.created_at`,
      [occurrenceId]
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Get occurrence activities error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch activities'
    });
  }
};

/**
 * Create a new quiz activity
 */
exports.createActivity = async (req, res) => {
  try {
    const { occurrenceId } = req.params;
    const { activityType, title, description, durationMinutes, config } = req.body;
    const userId = req.user.id;

    if (!title) {
      return res.status(400).json({
        success: false,
        error: 'Activity title is required'
      });
    }

    const result = await pool.query(
      `INSERT INTO event_activities (occurrence_id, activity_type, title, description, duration_minutes, config, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [occurrenceId, activityType || 'quiz', title, description, durationMinutes, JSON.stringify(config || {}), userId]
    );

    res.status(201).json({
      success: true,
      message: 'Activity created successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Create activity error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create activity'
    });
  }
};

/**
 * Update activity
 */
exports.updateActivity = async (req, res) => {
  try {
    const { activityId } = req.params;
    const { title, description, durationMinutes, status, config } = req.body;

    const result = await pool.query(
      `UPDATE event_activities 
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           duration_minutes = COALESCE($3, duration_minutes),
           status = COALESCE($4, status),
           config = COALESCE($5, config),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6
       RETURNING *`,
      [title, description, durationMinutes, status, JSON.stringify(config), activityId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Activity not found'
      });
    }

    res.json({
      success: true,
      message: 'Activity updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Update activity error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update activity'
    });
  }
};

/**
 * Delete activity
 */
exports.deleteActivity = async (req, res) => {
  try {
    const { activityId } = req.params;

    await pool.query(
      `UPDATE event_activities SET is_active = false WHERE id = $1`,
      [activityId]
    );

    res.json({
      success: true,
      message: 'Activity deleted successfully'
    });
  } catch (error) {
    console.error('Delete activity error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete activity'
    });
  }
};

/**
 * Get categories for an activity
 */
exports.getCategories = async (req, res) => {
  try {
    const { activityId } = req.params;

    const result = await pool.query(
      `SELECT * FROM quiz_categories 
       WHERE activity_id = $1 AND is_active = true
       ORDER BY display_order, id`,
      [activityId]
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch categories'
    });
  }
};

/**
 * Create a new category
 */
exports.createCategory = async (req, res) => {
  try {
    const { activityId } = req.params;
    const { categoryName, description, icon, color, displayOrder } = req.body;

    if (!categoryName) {
      return res.status(400).json({
        success: false,
        error: 'Category name is required'
      });
    }

    const result = await pool.query(
      `INSERT INTO quiz_categories (activity_id, category_name, description, icon, color, display_order)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [activityId, categoryName, description, icon, color, displayOrder || 0]
    );

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create category'
    });
  }
};

/**
 * Update category
 */
exports.updateCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { categoryName, description, icon, color, displayOrder } = req.body;

    const result = await pool.query(
      `UPDATE quiz_categories 
       SET category_name = COALESCE($1, category_name),
           description = COALESCE($2, description),
           icon = COALESCE($3, icon),
           color = COALESCE($4, color),
           display_order = COALESCE($5, display_order),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6
       RETURNING *`,
      [categoryName, description, icon, color, displayOrder, categoryId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Category not found'
      });
    }

    res.json({
      success: true,
      message: 'Category updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update category'
    });
  }
};

/**
 * Delete category
 */
exports.deleteCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;

    await pool.query(
      `UPDATE quiz_categories SET is_active = false WHERE id = $1`,
      [categoryId]
    );

    res.json({
      success: true,
      message: 'Category deleted successfully'
    });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete category'
    });
  }
};

/**
 * Get questions for a category
 */
exports.getQuestions = async (req, res) => {
  try {
    const { categoryId } = req.params;

    const result = await pool.query(
      `SELECT q.*, CONCAT(u.first_name, ' ', u.last_name) as creator_name
       FROM quiz_questions q
       LEFT JOIN users u ON q.created_by = u.id
       WHERE q.category_id = $1 AND q.is_active = true
       ORDER BY q.display_order, q.id`,
      [categoryId]
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Get questions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch questions'
    });
  }
};

/**
 * Create a new question
 */
exports.createQuestion = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const {
      questionText,
      questionType,
      optionA,
      optionB,
      optionC,
      optionD,
      correctOption,
      correctAnswer,
      positiveMarks,
      negativeMarks,
      timeLimitSeconds,
      imageUrl,
      videoUrl,
      youtubeVideoId,
      videoStartTime,
      videoEndTime,
      explanation,
      referenceText,
      referenceUrl,
      difficulty,
      displayOrder,
      tags
    } = req.body;
    const userId = req.user.id;

    if (!questionText) {
      return res.status(400).json({
        success: false,
        error: 'Question text is required'
      });
    }

    const result = await pool.query(
      `INSERT INTO quiz_questions (
        category_id, question_text, question_type,
        option_a, option_b, option_c, option_d, correct_option,
        correct_answer, positive_marks, negative_marks, time_limit_seconds,
        image_url, video_url, youtube_video_id, video_start_time, video_end_time,
        explanation, reference_text, reference_url,
        difficulty, display_order, tags, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
      RETURNING *`,
      [
        categoryId, questionText, questionType || 'mcq',
        optionA, optionB, optionC, optionD, correctOption,
        correctAnswer, positiveMarks || 10, negativeMarks || -2, timeLimitSeconds || 30,
        imageUrl, videoUrl, youtubeVideoId, videoStartTime, videoEndTime,
        explanation, referenceText, referenceUrl,
        difficulty || 'medium', displayOrder || 0, tags, userId
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Question created successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Create question error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create question'
    });
  }
};

/**
 * Update question
 */
exports.updateQuestion = async (req, res) => {
  try {
    const { questionId } = req.params;
    const {
      questionText,
      questionType,
      optionA,
      optionB,
      optionC,
      optionD,
      correctOption,
      correctAnswer,
      positiveMarks,
      negativeMarks,
      timeLimitSeconds,
      imageUrl,
      videoUrl,
      youtubeVideoId,
      explanation,
      difficulty
    } = req.body;

    const result = await pool.query(
      `UPDATE quiz_questions 
       SET question_text = COALESCE($1, question_text),
           question_type = COALESCE($2, question_type),
           option_a = COALESCE($3, option_a),
           option_b = COALESCE($4, option_b),
           option_c = COALESCE($5, option_c),
           option_d = COALESCE($6, option_d),
           correct_option = COALESCE($7, correct_option),
           correct_answer = COALESCE($8, correct_answer),
           positive_marks = COALESCE($9, positive_marks),
           negative_marks = COALESCE($10, negative_marks),
           time_limit_seconds = COALESCE($11, time_limit_seconds),
           image_url = COALESCE($12, image_url),
           video_url = COALESCE($13, video_url),
           youtube_video_id = COALESCE($14, youtube_video_id),
           explanation = COALESCE($15, explanation),
           difficulty = COALESCE($16, difficulty),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $17
       RETURNING *`,
      [
        questionText, questionType, optionA, optionB, optionC, optionD,
        correctOption, correctAnswer, positiveMarks, negativeMarks,
        timeLimitSeconds, imageUrl, videoUrl, youtubeVideoId,
        explanation, difficulty, questionId
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Question not found'
      });
    }

    res.json({
      success: true,
      message: 'Question updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Update question error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update question'
    });
  }
};

/**
 * Delete question
 */
exports.deleteQuestion = async (req, res) => {
  try {
    const { questionId } = req.params;

    await pool.query(
      `UPDATE quiz_questions SET is_active = false WHERE id = $1`,
      [questionId]
    );

    res.json({
      success: true,
      message: 'Question deleted successfully'
    });
  } catch (error) {
    console.error('Delete question error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete question'
    });
  }
};

/**
 * Get video shares for an occurrence
 */
exports.getVideoShares = async (req, res) => {
  try {
    const { occurrenceId } = req.params;

    const result = await pool.query(
      `SELECT v.*, CONCAT(u.first_name, ' ', u.last_name) as shared_by_name
       FROM video_shares v
       LEFT JOIN users u ON v.shared_by = u.id
       WHERE v.occurrence_id = $1 AND v.is_active = true
       ORDER BY v.shared_at DESC`,
      [occurrenceId]
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Get video shares error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch video shares'
    });
  }
};

/**
 * Share a YouTube video
 */
exports.shareVideo = async (req, res) => {
  try {
    const { occurrenceId } = req.params;
    const {
      youtubeVideoId,
      videoUrl,
      title,
      description,
      thumbnailUrl,
      duration,
      watchBeforeDate,
      category,
      notes
    } = req.body;
    const userId = req.user.id;

    if (!youtubeVideoId || !videoUrl) {
      return res.status(400).json({
        success: false,
        error: 'YouTube video ID and URL are required'
      });
    }

    const result = await pool.query(
      `INSERT INTO video_shares (
        occurrence_id, youtube_video_id, video_url, title, description,
        thumbnail_url, duration, watch_before_date, category, notes, shared_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        occurrenceId, youtubeVideoId, videoUrl, title, description,
        thumbnailUrl, duration, watchBeforeDate, category, notes, userId
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Video shared successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Share video error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to share video'
    });
  }
};

/**
 * Delete video share
 */
exports.deleteVideoShare = async (req, res) => {
  try {
    const { videoId } = req.params;

    await pool.query(
      `UPDATE video_shares SET is_active = false WHERE id = $1`,
      [videoId]
    );

    res.json({
      success: true,
      message: 'Video share deleted successfully'
    });
  } catch (error) {
    console.error('Delete video share error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete video share'
    });
  }
};
