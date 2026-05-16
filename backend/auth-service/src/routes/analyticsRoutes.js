/**
 * =====================================================================
 * Analytics Routes
 * Company: emeelan
 * =====================================================================
 * API routes for analytics and reporting
 */

const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const paginatedController = require('../controllers/paginatedAnalyticsController');
const { protect } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// Dashboard
router.get('/dashboard', analyticsController.getDashboardSummary);

// Reports (aggregated summaries)
router.get('/demographic', analyticsController.getDemographicReport);
router.get('/age-distribution', analyticsController.getAgeDistributionReport);
router.get('/gotras', analyticsController.getGotraReport);
router.get('/families', analyticsController.getFamilyReport);

// Advanced Reports
router.get('/agriculture', analyticsController.getAgricultureReport);
router.get('/occupation', analyticsController.getOccupationReport);

// Paginated Lists (for large datasets - 1M+ records)
router.get('/members/paginated', paginatedController.getPaginatedMembers);
router.get('/families/paginated', paginatedController.getPaginatedFamilies);
router.get('/filter-options', paginatedController.getFilterOptions);

// Filters/Helpers
router.get('/geography/:level', analyticsController.getGeographicHierarchy);
router.get('/temples', analyticsController.getTemples);

// Admin
router.post('/refresh', analyticsController.refreshAnalytics);

module.exports = router;
