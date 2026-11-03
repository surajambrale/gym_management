const Business = require('../models/Business');

const businessFields = ['businessName', 'businessType', 'phone', 'email', 'address'];
const businessTypes = ['Gym', 'Yoga Studio', 'Fitness Studio', 'Other'];

exports.getSettings = async (req, res) => {
  try {
    const business = await Business.findById(req.tenantId).select(
      'businessName businessType ownerName phone email address subscriptionStatus'
    );
    if (!business) {
      return res.status(404).json({ success: false, message: 'Business not found' });
    }
    return res.json({ success: true, business });
  } catch (error) {
    console.error('Get business settings error:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to load business settings'
    });
  }
};

exports.updateSettings = async (req, res) => {
  const updates = {};
  for (const field of businessFields) {
    if (Object.prototype.hasOwnProperty.call(req.body, field)) {
      updates[field] = req.body[field];
    }
  }

  if (updates.businessName !== undefined) {
    updates.businessName = String(updates.businessName).trim();
    if (!updates.businessName) {
      return res.status(400).json({
        success: false,
        message: 'Business name is required'
      });
    }
  }
  if (updates.businessType !== undefined && !businessTypes.includes(updates.businessType)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid business type'
    });
  }
  if (updates.phone !== undefined) updates.phone = String(updates.phone).trim();
  if (updates.email !== undefined) updates.email = String(updates.email).trim().toLowerCase();
  if (updates.address !== undefined) updates.address = String(updates.address).trim();

  try {
    const business = await Business.findByIdAndUpdate(
      req.tenantId,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('businessName businessType ownerName phone email address subscriptionStatus');
    if (!business) {
      return res.status(404).json({ success: false, message: 'Business not found' });
    }
    return res.json({ success: true, business });
  } catch (error) {
    console.error('Update business settings error:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to update business settings'
    });
  }
};

exports.getSubscription = async (req, res) => {
  try {
    const business = await Business.findById(req.tenantId)
      .select('businessName subscriptionStatus')
      .lean();
    if (!business) {
      return res.status(404).json({ success: false, message: 'Business not found' });
    }
    return res.json({
      success: true,
      subscription: {
        status: business.subscriptionStatus,
        planName: null,
        price: null,
        renewalDate: null,
        billingProvider: null,
        billingConfigured: false
      }
    });
  } catch (error) {
    console.error('Get subscription status error:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to load subscription status'
    });
  }
};
