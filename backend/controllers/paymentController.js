
const mongoose = require('mongoose');

const Payment = require('../models/Payment');
const Member = require('../models/Member');
const MemberMembership = require('../models/MemberMembership');

// Create Payment
exports.createPayment = async (req, res) => {
  let session;

  try {
    const {
      memberId,
      membershipId,
      amount,
      paymentMethod,
      paymentType,
      transactionId,
      paymentDate,
      notes
    } = req.body;

    // Basic validation
    if (!memberId || !membershipId || amount === undefined || amount === null || amount === '' || !paymentMethod) {
      return res.status(400).json({
        success: false,
        message: 'Member, membership, amount and payment method are required'
      });
    }

    if (
      !mongoose.Types.ObjectId.isValid(memberId) ||
      !mongoose.Types.ObjectId.isValid(membershipId)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid member or membership ID'
      });
    }

    const paymentAmount = Number(amount);

    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Enter a valid payment amount'
      });
    }

    const allowedMethods = [
      'Cash',
      'UPI',
      'Card',
      'Bank Transfer',
      'Razorpay'
    ];

    if (!allowedMethods.includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment method'
      });
    }

    const allowedTypes = [
      'Membership Fee',
      'Registration Fee',
      'Other'
    ];

    const selectedPaymentType = paymentType || 'Membership Fee';

    if (!allowedTypes.includes(selectedPaymentType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment type'
      });
    }

    const selectedDate = paymentDate
      ? new Date(paymentDate)
      : new Date();

    if (Number.isNaN(selectedDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment date'
      });
    }

    // Generate receipt outside transaction
    const receiptNumber =
      `SS${Date.now()}${Math.floor(1000 + Math.random() * 9000)}`;

    session = await mongoose.startSession();

    let createdPaymentId;

    await session.withTransaction(async () => {

      // Verify member belongs to logged-in owner's business
      const member = await Member.findOne({
        _id: memberId,
        tenantId: req.tenantId
      }).session(session);

      if (!member) {
        throw new Error('Member not found');
      }

      // Verify membership belongs to this member and tenant
      const membership = await MemberMembership.findOne({
        _id: membershipId,
        memberId,
        tenantId: req.tenantId
      }).session(session);

      if (!membership) {
        throw new Error('Membership not found');
      }

      const currentPaidAmount = Number(membership.paidAmount || 0);
      const planPrice = Number(membership.planPrice);

      const pendingAmount = planPrice - currentPaidAmount;

      if (pendingAmount <= 0) {
        throw new Error('This membership has no pending fees');
      }

      if (paymentAmount > pendingAmount) {
        throw new Error(
          `Payment cannot exceed pending amount of ₹${pendingAmount}`
        );
      }

      // Create payment record
      const payment = new Payment({
        tenantId: req.tenantId,
        businessId: req.owner.businessId,
        memberId,
        membershipId,
        amount: paymentAmount,
        paymentMethod,
        paymentType: selectedPaymentType,
        transactionId: transactionId || '',
        paymentDate: selectedDate,
        status: 'Success',
        notes: notes || '',
        receiptNumber,
        createdBy: req.owner._id
      });

      await payment.save({ session });

      createdPaymentId = payment._id;

      // Update membership paid amount
      membership.paidAmount = currentPaidAmount + paymentAmount;

      if (membership.paidAmount >= planPrice) {
        membership.paymentStatus = 'Paid';
      } else if (membership.paidAmount > 0) {
        membership.paymentStatus = 'Partial';
      } else {
        membership.paymentStatus = 'Pending';
      }

      await membership.save({ session });
    });

    // Fetch the exact payment created by this request
    const savedPayment = await Payment.findOne({
      _id: createdPaymentId,
      tenantId: req.tenantId
    })
      .populate('memberId', 'fullName phone')
      .populate('membershipId', 'planPrice paidAmount paymentStatus');

    return res.status(201).json({
      success: true,
      message: 'Payment recorded successfully',
      payment: savedPayment
    });

  } catch (error) {
    console.error('Create Payment Error:', error);

    const statusCode =
      error.message === 'Member not found' ||
      error.message === 'Membership not found'
        ? 404
        : 400;

    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to record payment'
    });

  } finally {
    if (session) {
      await session.endSession();
    }
  }
};


// Get All Payments
exports.getAllPayments = async (req, res) => {
  try {
    const payments = await Payment.find({
      tenantId: req.tenantId
    })
      .populate('memberId', 'fullName phone')
      .populate('membershipId', 'planPrice paidAmount paymentStatus')
      .sort({ paymentDate: -1 });

    return res.status(200).json({
      success: true,
      count: payments.length,
      payments
    });

  } catch (error) {
    console.error('Get Payments Error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch payments'
    });
  }
};

// Get payment history of a specific member
exports.getMemberPayments = async (req, res) => {
  try {
    const { memberId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(memberId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid member ID'
      });
    }

    // Verify member belongs to logged-in owner's business
    const member = await Member.findOne({
      _id: memberId,
      tenantId: req.tenantId
    });

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    const payments = await Payment.find({
      tenantId: req.tenantId,
      memberId
    })
      .populate('membershipId', 'planPrice paidAmount paymentStatus startDate endDate')
      .sort({ paymentDate: -1 });

    return res.status(200).json({
      success: true,
      count: payments.length,
      payments
    });

  } catch (error) {
    console.error('Get member payments error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch member payment history'
    });
  }
};