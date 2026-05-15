/**
 * =====================================================================
 * JWT Utilities
 * Company: emeelan
 * =====================================================================
 */

const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'emeelan-seervi-portal-secret-key-2026';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '30d';

/**
 * Generate access token
 */
const generateAccessToken = (userId, email, slug = null) => {
  const payload = { userId, email, type: 'access' };
  
  // Add slug if provided (Phase 1: Slug ID migration)
  if (slug) {
    payload.slug = slug;
  }
  
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

/**
 * Generate refresh token
 */
const generateRefreshToken = (userId, email, slug = null) => {
  const payload = { userId, email, type: 'refresh' };
  
  // Add slug if provided (Phase 1: Slug ID migration)
  if (slug) {
    payload.slug = slug;
  }
  
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN });
};

/**
 * Verify token
 */
const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
};

/**
 * Generate both tokens
 */
const generateTokens = (userId, email, slug = null) => {
  return {
    accessToken: generateAccessToken(userId, email, slug),
    refreshToken: generateRefreshToken(userId, email, slug),
  };
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  generateTokens,
  verifyToken,
};
