const jwt = require('jsonwebtoken');
const Owner = require('../models/Owner');

const protectOwner = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication token required'
      });
    }

    const token = authHeader.split(' ')[1];

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    const owner = await Owner.findById(decoded.ownerId);

    if (!owner || !owner.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or inactive account'
      });
    }

    if (
      owner.tenantId.toString() !== decoded.tenantId ||
      owner.role !== decoded.role
    ) {
      return res.status(401).json({
        success: false,
        message: 'Invalid authentication details'
      });
    }

    req.owner = owner;
    req.tenantId = owner.tenantId;

    next();

  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
};

module.exports = { protectOwner };