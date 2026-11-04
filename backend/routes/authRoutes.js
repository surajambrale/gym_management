const express = require('express');
const router = express.Router();

const {
  registerOwner,
  loginOwner,
  getProfile,
  recordSessionActivity,
  refreshSession,
  logoutSession,
  getOwnerSessions,
  revokeOwnerSession,
  revokeOtherOwnerSessions,
  revokeAllOwnerSessions
} = require('../controllers/authController');

const {
  protectOwner
} = require('../middleware/authMiddleware');

// Owner Registration
router.post('/register', registerOwner);

// Owner Login
router.post('/login', loginOwner);

// Get authenticated Owner + Business Profile
router.get('/profile', protectOwner, getProfile);
router.post('/activity', protectOwner, recordSessionActivity);
router.post('/refresh', protectOwner, refreshSession);
router.post('/logout', logoutSession);
router.get('/sessions', protectOwner, getOwnerSessions);
router.delete('/sessions/others', protectOwner, revokeOtherOwnerSessions);
router.delete('/sessions/all', protectOwner, revokeAllOwnerSessions);
router.delete('/sessions/:sessionId', protectOwner, revokeOwnerSession);

module.exports = router;