const express = require('express');
const router = express.Router();

const { protectOwner } = require('../middleware/authMiddleware');
const { getDashboardStats } = require('../controllers/dashboardController');

router.get('/stats', protectOwner, getDashboardStats);

module.exports = router;