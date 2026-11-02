const Member = require('../models/Member');
const Attendance = require('../models/Attendance');
const MemberMembership = require('../models/MemberMembership');

exports.getDashboardStats = async (req, res) => {
  try {
    const tenantId = req.tenantId;

    // Today's attendance (UTC date range)
    const now = new Date();

    const startOfDay = new Date(now);
    startOfDay.setUTCHours(0, 0, 0, 0);

    const endOfDay = new Date(now);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const [totalMembers, activeMembers, todayAttendance, paymentSummary, recentMembers] =
      await Promise.all([
        Member.countDocuments({ tenantId }),
        Member.countDocuments({ tenantId, status: 'Active' }),
        Attendance.countDocuments({
          tenantId,
          attendanceDate: { $gte: startOfDay, $lte: endOfDay }
        }),
        MemberMembership.aggregate([
          { $match: { tenantId } },
          {
            $group: {
              _id: null,
              totalCollected: { $sum: '$paidAmount' },
              totalPending: {
                $sum: { $subtract: ['$planPrice', '$paidAmount'] }
              }
            }
          }
        ]),
        Member.find({ tenantId })
          .sort({ createdAt: -1 })
          .limit(5)
          .select('fullName phone status joiningDate createdAt')
          .lean()
      ]);

    res.status(200).json({
      success: true,
      stats: {
        totalMembers,
        activeMembers,
        todayAttendance,
        totalCollected: paymentSummary[0]?.totalCollected || 0,
        totalPending: paymentSummary[0]?.totalPending || 0
      },
      recentMembers
    });

  } catch (error) {
    console.error('Dashboard Stats Error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard statistics'
    });
  }
};