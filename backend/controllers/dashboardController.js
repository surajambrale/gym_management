const Member = require('../models/Member');
const Attendance = require('../models/Attendance');
const MemberMembership = require('../models/MemberMembership');

exports.getDashboardStats = async (req, res) => {
  try {
    const tenantId = req.tenantId;

    // Total and active members
    const totalMembers = await Member.countDocuments({
      tenantId
    });

    const activeMembers = await Member.countDocuments({
      tenantId,
      status: 'Active'
    });

    // Today's attendance (UTC date range)
    const now = new Date();

    const startOfDay = new Date(now);
    startOfDay.setUTCHours(0, 0, 0, 0);

    const endOfDay = new Date(now);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const todayAttendance = await Attendance.countDocuments({
      tenantId,
      attendanceDate: {
        $gte: startOfDay,
        $lte: endOfDay
      }
    });

    // Membership payment summary
    const paymentSummary = await MemberMembership.aggregate([
      {
        $match: {
          tenantId: tenantId
        }
      },
      {
        $group: {
          _id: null,
          totalCollected: { $sum: '$paidAmount' },
          totalPending: {
            $sum: {
              $subtract: ['$planPrice', '$paidAmount']
            }
          }
        }
      }
    ]);

    const totalCollected = paymentSummary[0]?.totalCollected || 0;
    const totalPending = paymentSummary[0]?.totalPending || 0;

    // Recent members
    const recentMembers = await Member.find({ tenantId })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('fullName phone status joiningDate createdAt');

    res.status(200).json({
      success: true,
      stats: {
        totalMembers,
        activeMembers,
        todayAttendance,
        totalCollected,
        totalPending
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