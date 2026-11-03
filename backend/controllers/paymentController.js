
const mongoose = require('mongoose');

const Payment = require('../models/Payment');
const Member = require('../models/Member');
const MemberMembership = require('../models/MemberMembership');
const { toMinorUnits, fromMinorUnits } = require('../utils/currency');

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

    const paymentCents = toMinorUnits(amount);

    if (paymentCents === null || paymentCents <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Enter a valid payment amount with no more than two decimal places'
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
        tenantId: req.tenantId,
        deletedAt: null
      }).session(session);

      if (!member) {
        throw new Error('Member not found');
      }

      // Verify membership belongs to this member and tenant
      const membership = await MemberMembership.findOne({
        _id: membershipId,
        memberId,
        tenantId: req.tenantId,
        status: { $ne: 'Cancelled' }
      }).session(session);

      if (!membership) {
        throw new Error('Membership not found');
      }

      const currentPaidCents = toMinorUnits(membership.paidAmount || 0);
      const planPriceCents = toMinorUnits(membership.planPrice);

      if (currentPaidCents === null || planPriceCents === null) {
        throw new Error('Membership balance is invalid');
      }

      const pendingCents = planPriceCents - currentPaidCents;

      if (pendingCents <= 0) {
        throw new Error('This membership has no pending fees');
      }

      if (paymentCents > pendingCents) {
        throw new Error(
          `Payment cannot exceed pending amount of ₹${fromMinorUnits(pendingCents)}`
        );
      }

      // Create payment record
      const payment = new Payment({
        tenantId: req.tenantId,
        businessId: req.owner.businessId,
        memberId,
        membershipId,
        amount: fromMinorUnits(paymentCents),
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
      membership.paidAmount = fromMinorUnits(
        currentPaidCents + paymentCents
      );

      if (currentPaidCents + paymentCents >= planPriceCents) {
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
    const currentPage = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const pageLimit = Math.min(
      100,
      Math.max(1, Number.parseInt(req.query.limit, 10) || 25)
    );
    const filter = { tenantId: req.tenantId };

    const [
      payments,
      summaryResult,
      outstandingResult,
      membershipCollectionResult
    ] = await Promise.all([
      Payment.find(filter)
        .select(
          'receiptNumber memberId membershipId amount paymentMethod paymentType transactionId paymentDate status notes'
        )
        .populate('memberId', 'fullName phone')
        .populate('membershipId', 'planPrice paidAmount paymentStatus')
        .sort({ paymentDate: -1 })
        .skip((currentPage - 1) * pageLimit)
        .limit(pageLimit)
        .lean(),
      Payment.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            totalTransactions: { $sum: 1 },
            totalCollection: {
              $sum: {
                $cond: [{ $eq: ['$status', 'Success'] }, '$amount', 0]
              }
            },
            pendingTransactions: {
              $sum: { $cond: [{ $eq: ['$status', 'Pending'] }, 1, 0] }
            }
          }
        }
      ]),
      MemberMembership.aggregate([
        {
          $match: {
            tenantId: req.tenantId,
            status: { $ne: 'Cancelled' }
          }
        },
        {
          $lookup: {
            from: 'members',
            let: { memberId: '$memberId' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$_id', '$$memberId'] },
                      { $eq: ['$tenantId', req.tenantId] },
                      { $eq: ['$deletedAt', null] }
                    ]
                  }
                }
              }
            ],
            as: 'member'
          }
        },
        { $match: { 'member.0': { $exists: true } } },
        {
          $group: {
            _id: null,
            totalOutstanding: {
              $sum: {
                $max: [
                  0,
                  {
                    $round: [
                      {
                        $subtract: [
                          '$planPrice',
                          { $ifNull: ['$paidAmount', 0] }
                        ]
                      },
                      2
                    ]
                  }
                ]
              }
            }
          }
        }
      ]),
      MemberMembership.aggregate([
        { $match: { tenantId: req.tenantId } },
        {
          $group: {
            _id: null,
            totalCollection: { $sum: { $ifNull: ['$paidAmount', 0] } }
          }
        }
      ])
    ]);

    const summary = summaryResult[0] || {
      totalTransactions: 0,
      totalCollection: 0,
      pendingTransactions: 0,
      totalOutstanding: 0
    };
    summary.totalOutstanding = outstandingResult[0]?.totalOutstanding || 0;
    summary.totalCollection =
      membershipCollectionResult[0]?.totalCollection || 0;
    const totalPages = Math.ceil(summary.totalTransactions / pageLimit);

    return res.status(200).json({
      success: true,
      count: summary.totalTransactions,
      payments,
      summary,
      pagination: {
        currentPage,
        pageLimit,
        totalPayments: summary.totalTransactions,
        totalPages,
        hasNextPage: currentPage < totalPages,
        hasPrevPage: currentPage > 1
      }
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
      tenantId: req.tenantId,
      deletedAt: null
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