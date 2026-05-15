/**
 * =====================================================================
 * Quiz Routes
 * Company: emeelan
 * =====================================================================
 * Routes for quiz management (activities, categories, questions, videos)
 */

const express = require('express');
const router = express.Router();
const quizController = require('../controllers/quizController');
const { protect } = require('../middleware/auth');

// Activity routes
router.get('/occurrences/:occurrenceId/activities', protect, quizController.getOccurrenceActivities);
router.post('/occurrences/:occurrenceId/activities', protect, quizController.createActivity);
router.put('/activities/:activityId', protect, quizController.updateActivity);
router.delete('/activities/:activityId', protect, quizController.deleteActivity);

// Category routes
router.get('/activities/:activityId/categories', protect, quizController.getCategories);
router.post('/activities/:activityId/categories', protect, quizController.createCategory);
router.put('/categories/:categoryId', protect, quizController.updateCategory);
router.delete('/categories/:categoryId', protect, quizController.deleteCategory);

// Question routes
router.get('/categories/:categoryId/questions', protect, quizController.getQuestions);
router.post('/categories/:categoryId/questions', protect, quizController.createQuestion);
router.put('/questions/:questionId', protect, quizController.updateQuestion);
router.delete('/questions/:questionId', protect, quizController.deleteQuestion);

// Video share routes
router.get('/occurrences/:occurrenceId/videos', protect, quizController.getVideoShares);
router.post('/occurrences/:occurrenceId/videos', protect, quizController.shareVideo);
router.delete('/videos/:videoId', protect, quizController.deleteVideoShare);

module.exports = router;
