/**
 * =====================================================================
 * Events Routes
 * Company: emeelan
 * =====================================================================
 * API routes for events management
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const eventsController = require('../controllers/eventsController');

// All routes require authentication
router.use(protect);

// Event Settings
router.get('/settings/:templeId', eventsController.getEventSettings);
router.put('/settings/:templeId', eventsController.updateEventSettings);

// Event Categories
router.get('/categories/:templeId', eventsController.getEventCategories);
router.post('/categories', eventsController.createEventCategory);
router.put('/categories/:id', eventsController.updateEventCategory);
router.delete('/categories/:id', eventsController.deleteEventCategory);

// Events CRUD
router.get('/', eventsController.getAllEvents);
router.get('/:id', eventsController.getEventById);
router.post('/', eventsController.createEvent);
router.put('/:id', eventsController.updateEvent);
router.delete('/:id', eventsController.deleteEvent);

// Phase 3: Registration & Attendance
router.post('/:id/register', eventsController.registerForEvent);
router.get('/:id/participants', eventsController.getEventParticipants);
router.put('/:id/participants/:participantId/attendance', eventsController.markAttendance);
router.post('/:id/attendance/bulk', eventsController.bulkMarkAttendance);

// Phase 3: Documents
router.post('/:id/documents', eventsController.uploadEventDocument);
router.get('/:id/documents', eventsController.getEventDocuments);
router.delete('/:id/documents/:documentId', eventsController.deleteEventDocument);

module.exports = router;
