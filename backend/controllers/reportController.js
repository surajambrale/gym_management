const Attendance = require('../models/Attendance');
const Member = require('../models/Member');
const MemberMembership = require('../models/MemberMembership');
const Payment = require('../models/Payment');

const parseDate = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value
    ? null
    : date;
};

exports.getOperationalReport = async (req, res) => {
  const endDate = req.query.to ? parseDate(req.query.to) : new Date();
  const normalizedEnd = endDate
    ? new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate()))
    : null;
  const startDate = req.query.from
    ? parseDate(req.query.from)
    : normalizedEnd && new Date(normalizedEnd.getTime() - 29 * 86400000);
  const normalizedStart = startDate
    ? new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()))
    : null;

  if (
    !normalizedStart ||
    !normalizedEnd ||
    normalizedStart > normalizedEnd ||
    normalizedEnd.getTime() - normalizedStart.getTime() > 365 * 86400000
  ) {
    return res.status(400).json({
      success: false,
      message: 'Choose a valid date range no longer than 366 days'
    });
  }
  normalizedEnd.setUTCHours(23, 59, 59, 999);

  try {
    const tenantId = req.tenantId;
    const [members, attendance, payments, outstanding] = await Promise.all([
      Member.aggregate([
        {
          $match: {
            tenantId,
            deletedAt: null,
            joiningDate: { $gte: normalizedStart, $lte: normalizedEnd }
          }
        },
        { $group: { _id: null, joined: { $sum: 1 } } }
      ]),
      Attendance.aggregate([
        {
          $match: {
            tenantId,
            attendanceDate: { $gte: normalizedStart, $lte: normalizedEnd }
          }
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$attendanceDate', timezone: 'UTC' } },
            visits: { $sum: 1 },
            checkedOut: {
              $sum: { $cond: [{ $ne: ['$checkOut', null] }, 1, 0] }
            },
            durationMinutes: {
              $sum: {
                $cond: [
                  { $ne: ['$checkOut', null] },
                  {
                    $floor: {
                      $divide: [
                        { $subtract: ['$checkOut', '$checkIn'] },
                        60000
                      ]
                    }
                  },
                  0
                ]
              }
            }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      Payment.aggregate([
        {
          $match: {
            tenantId,
            paymentDate: { $gte: normalizedStart, $lte: normalizedEnd }
          }
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$paymentDate', timezone: 'UTC' } },
            transactions: { $sum: 1 },
            successfulAmount: {
              $sum: { $cond: [{ $eq: ['$status', 'Success'] }, '$amount', 0] }
            },
            pendingTransactions: {
              $sum: { $cond: [{ $eq: ['$status', 'Pending'] }, 1, 0] }
            }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      MemberMembership.aggregate([
        { $match: { tenantId, status: { $ne: 'Cancelled' } } },
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
            amount: {
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
    ]);

    const attendanceByDay = new Map(attendance.map((row) => [row._id, row]));
    const paymentsByDay = new Map(payments.map((row) => [row._id, row]));
    const daily = [];
    for (let cursor = new Date(normalizedStart); cursor <= normalizedEnd; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
      const key = cursor.toISOString().slice(0, 10);
      const attendanceRow = attendanceByDay.get(key);
      const paymentRow = paymentsByDay.get(key);
      daily.push({
        date: key,
        attendance: attendanceRow?.visits || 0,
        checkedOut: attendanceRow?.checkedOut || 0,
        durationMinutes: attendanceRow?.durationMinutes || 0,
        transactions: paymentRow?.transactions || 0,
        successfulAmount: paymentRow?.successfulAmount || 0,
        pendingTransactions: paymentRow?.pendingTransactions || 0
      });
    }

    return res.json({
      success: true,
      from: normalizedStart.toISOString().slice(0, 10),
      to: normalizedEnd.toISOString().slice(0, 10),
      summary: {
        membersJoined: members[0]?.joined || 0,
        attendanceVisits: attendance.reduce((sum, row) => sum + row.visits, 0),
        gymDurationMinutes: attendance.reduce(
          (sum, row) => sum + row.durationMinutes,
          0
        ),
        successfulCollection: payments.reduce((sum, row) => sum + row.successfulAmount, 0),
        transactions: payments.reduce((sum, row) => sum + row.transactions, 0),
        pendingTransactions: payments.reduce((sum, row) => sum + row.pendingTransactions, 0),
        outstandingMembershipFees: outstanding[0]?.amount || 0
      },
      daily
    });
  } catch (error) {
    console.error('Operational report error:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to generate operational report'
    });
  }
};
