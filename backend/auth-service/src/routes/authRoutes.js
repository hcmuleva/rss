/**
 * =====================================================================
 * Authentication Routes
 * Company: emeelan
 * =====================================================================
 */

const express = require('express');
const router = express.Router();
const {
  register,
  login,
  refreshToken,
  getMe,
  logout,
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');

// Public routes
router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refreshToken);

// Protected routes
router.get('/me', protect, getMe);
router.post('/logout', protect, logout);

// Token verification endpoint (for other services)
router.get('/verify', protect, (req, res) => {
  // If protect middleware passed, token is valid
  res.json({
    success: true,
    user: req.user
  });
});

module.exports = router;
