const express = require('express');
const router = express.Router();

const { protectOwner } = require('../middleware/authMiddleware');

const {
  createPayment,
  getAllPayments,
  getMemberPayments
} = require('../controllers/paymentController');

// Record new payment
router.post('/', protectOwner, createPayment);

// Get payment history of a specific member
router.get('/member/:memberId', protectOwner, getMemberPayments);

// Get all business payments
router.get('/', protectOwner, getAllPayments);

module.exports = router;