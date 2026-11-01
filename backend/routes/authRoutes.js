const express = require('express');
const router = express.Router();

const {
  registerOwner,
  loginOwner,
  getProfile
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

module.exports = router;