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
        Member.countDocuments({ tenantId, deletedAt: null }),
        Member.countDocuments({ tenantId, deletedAt: null, status: 'Active' }),
        Attendance.countDocuments({
          tenantId,
          attendanceDate: { $gte: startOfDay, $lte: endOfDay }
        }),
        Promise.all([
          MemberMembership.aggregate([
            { $match: { tenantId } },
            { $group: { _id: null, totalCollected: { $sum: '$paidAmount' } } }
          ]),
          MemberMembership.aggregate([
            {
              $match: {
                tenantId,
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
                          { $eq: ['$tenantId', tenantId] },
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
                totalPending: {
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
          ])
        ]),
        Member.find({ tenantId, deletedAt: null })
          .sort({ createdAt: -1 })
          .limit(5)
          .select('fullName phone status joiningDate createdAt')
          .lean()
      ]);

    const [collectionResult, outstandingResult] = paymentSummary;

    res.status(200).json({
      success: true,
      stats: {
        totalMembers,
        activeMembers,
        todayAttendance,
        totalCollected: collectionResult[0]?.totalCollected || 0,
        totalPending: outstandingResult[0]?.totalPending || 0
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