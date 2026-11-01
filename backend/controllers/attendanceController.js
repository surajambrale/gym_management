const Attendance = require('../models/Attendance');
const Member = require('../models/Member');
const crypto = require('crypto');

// Get start of day in UTC
const getDayStart = (dateValue) => {
  const date = dateValue ? new Date(dateValue) : new Date();

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate()
  ));
};

// Member Check-in
const checkIn = async (req, res) => {
  try {
    const { memberId, attendanceType, notes, attendanceDate } = req.body;

    if (!memberId) {
      return res.status(400).json({
        success: false,
        message: 'Member ID is required'
      });
    }

    const member = await Member.findOne({
      _id: memberId,
      tenantId: req.tenantId,
      status: 'Active'
    });

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Active member not found'
      });
    }

    const dayStart = getDayStart(attendanceDate);

    if (!dayStart) {
      return res.status(400).json({
        success: false,
        message: 'Invalid attendance date'
      });
    }

    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    // Prevent duplicate check-in on the same day
    const existingAttendance = await Attendance.findOne({
      tenantId: req.tenantId,
      memberId,
      attendanceDate: {
        $gte: dayStart,
        $lt: dayEnd
      }
    });

    if (existingAttendance) {
      return res.status(409).json({
        success: false,
        message: 'Attendance already marked for this member today',
        attendance: existingAttendance
      });
    }

    const allowedTypes = ['Manual', 'QR', 'Biometric'];
    const type = attendanceType || 'Manual';

    if (!allowedTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid attendance type'
      });
    }

    const attendance = await Attendance.create({
      tenantId: req.tenantId,
      businessId: req.owner.businessId,
      memberId,
      attendanceDate: dayStart,
      checkIn: new Date(),
      attendanceType: type,
      status: 'Present',
      notes: notes || '',
      createdBy: req.owner._id
    });

    return res.status(201).json({
      success: true,
      message: 'Member check-in successful',
      attendance
    });

  } catch (error) {
    console.error('Check-in error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to mark attendance'
    });
  }
};


// Member Check-out
const checkOut = async (req, res) => {
  try {
    const { memberId } = req.body;

    if (!memberId) {
      return res.status(400).json({
        success: false,
        message: 'Member ID is required'
      });
    }

    const dayStart = getDayStart();
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    const attendance = await Attendance.findOne({
      tenantId: req.tenantId,
      memberId,
      attendanceDate: {
        $gte: dayStart,
        $lt: dayEnd
      },
      checkOut: null
    }).sort({ checkIn: -1 });

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: 'No open check-in found for this member today'
      });
    }

    attendance.checkOut = new Date();
    await attendance.save();

    return res.status(200).json({
      success: true,
      message: 'Member check-out successful',
      attendance
    });

  } catch (error) {
    console.error('Check-out error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to mark check-out'
    });
  }
};


// Get Daily Attendance
const getDailyAttendance = async (req, res) => {
  try {
    const dayStart = getDayStart(req.query.date);

    if (!dayStart) {
      return res.status(400).json({
        success: false,
        message: 'Invalid attendance date'
      });
    }

    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    const attendance = await Attendance.find({
      tenantId: req.tenantId,
      attendanceDate: {
        $gte: dayStart,
        $lt: dayEnd
      }
    })
      .populate('memberId', 'fullName phone')
      .sort({ checkIn: -1 });

    return res.status(200).json({
      success: true,
      total: attendance.length,
      attendance
    });

  } catch (error) {
    console.error('Daily attendance error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to fetch attendance'
    });
  }
};


// Get Member Attendance History
const getMemberAttendance = async (req, res) => {
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

    const attendance = await Attendance.find({
      tenantId: req.tenantId,
      memberId
    }).sort({ attendanceDate: -1, checkIn: -1 });

    return res.status(200).json({
      success: true,
      total: attendance.length,
      attendance
    });

  } catch (error) {
    console.error('Member attendance history error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to fetch member attendance history'
    });
  }
};

// QR Code Attendance Check-in
exports.checkInWithQR = async (req, res) => {
  try {
    const { qrToken } = req.body;

    if (!qrToken) {
      return res.status(400).json({
        success: false,
        message: 'QR token is required'
      });
    }

    // Hash the received QR token
    const tokenHash = crypto
      .createHash('sha256')
      .update(qrToken)
      .digest('hex');

    // Find member using tenant ID and QR token hash
    const member = await Member.findOne({
      tenantId: req.tenantId,
      qrTokenHash: tokenHash,
      status: 'Active'
    });

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Invalid QR code or inactive member'
      });
    }

    // Get today's date range
    const dayStart = getDayStart();
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    // Prevent duplicate attendance
    const existingAttendance = await Attendance.findOne({
      tenantId: req.tenantId,
      memberId: member._id,
      attendanceDate: {
        $gte: dayStart,
        $lt: dayEnd
      }
    });

    if (existingAttendance) {
      return res.status(409).json({
        success: false,
        message: 'Attendance already marked for today'
      });
    }

    // Create QR attendance
    const attendance = await Attendance.create({
      tenantId: req.tenantId,
      businessId: req.owner.businessId,
      memberId: member._id,
      attendanceDate: dayStart,
      checkIn: new Date(),
      attendanceType: 'QR',
      status: 'Present',
      notes: 'QR Code Check-in',
      createdBy: req.owner._id
    });

    return res.status(201).json({
      success: true,
      message: 'QR attendance marked successfully',
      member: {
        id: member._id,
        fullName: member.fullName,
        phone: member.phone
      },
      attendance
    });

  } catch (error) {
    console.error('QR Check-in Error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to mark QR attendance'
    });
  }
};


module.exports = {
  checkIn,
  checkOut,
  getDailyAttendance,
  getMemberAttendance,
  checkInWithQR: exports.checkInWithQR
};