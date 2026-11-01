
const MemberMembership = require('../models/MemberMembership');
const Member = require('../models/Member');
const MembershipPlan = require('../models/MembershipPlan');

const addDuration = (date, duration, durationType) => {
  const result = new Date(date);

  if (durationType === 'Days') {
    result.setDate(result.getDate() + duration);
  } else if (durationType === 'Months') {
    result.setMonth(result.getMonth() + duration);
  } else if (durationType === 'Years') {
    result.setFullYear(result.getFullYear() + duration);
  }

  return result;
};

// Assign membership to a member
const assignMembership = async (req, res) => {
  try {
    const { memberId, planId, startDate, paidAmount = 0 } = req.body;

    if (!memberId || !planId || !startDate) {
      return res.status(400).json({
        success: false,
        message: 'Member, plan and start date are required'
      });
    }

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

    const plan = await MembershipPlan.findOne({
      _id: planId,
      tenantId: req.tenantId,
      status: 'Active'
    });

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Active membership plan not found'
      });
    }

    const amountPaid = Number(paidAmount);

    if (
      !Number.isFinite(amountPaid) ||
      amountPaid < 0 ||
      amountPaid > plan.price
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid paid amount'
      });
    }

    const membershipStartDate = new Date(startDate);

    if (Number.isNaN(membershipStartDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid start date'
      });
    }

    const endDate = addDuration(
      membershipStartDate,
      plan.duration,
      plan.durationType
    );

    const paymentStatus =
      amountPaid === plan.price
        ? 'Paid'
        : amountPaid > 0
          ? 'Partial'
          : 'Pending';

    const membership = await MemberMembership.create({
      tenantId: req.tenantId,
      businessId: req.owner.businessId,
      memberId: member._id,
      planId: plan._id,
      startDate: membershipStartDate,
      endDate,
      planPrice: plan.price,
      paidAmount: amountPaid,
      paymentStatus,
      status: 'Active',
      createdBy: req.owner._id
    });

    return res.status(201).json({
      success: true,
      message: 'Membership assigned successfully',
      membership
    });

  } catch (error) {
    console.error('Assign Membership Error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to assign membership'
    });
  }
};

// Get membership history of a member
const getMemberMemberships = async (req, res) => {
  try {
    const { memberId } = req.params;

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

    const memberships = await MemberMembership.find({
      memberId,
      tenantId: req.tenantId
    })
      .populate('planId', 'planName duration durationType price')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      memberships
    });

  } catch (error) {
    console.error('Get Membership History Error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch membership history'
    });
  }
};

module.exports = {
  assignMembership,
  getMemberMemberships
};
