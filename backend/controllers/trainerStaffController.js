const mongoose = require('mongoose');
const TrainerStaff = require('../models/TrainerStaff');

const allowedFields = ['name', 'phone', 'email', 'role', 'specialization', 'status'];

const validateAndBuild = (body, isCreate) => {
  const data = {};
  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      data[field] = body[field];
    }
  }

  if (isCreate || data.name !== undefined) {
    data.name = String(data.name || '').trim();
    if (!data.name) return { error: 'Name is required' };
  }

  if (isCreate || data.phone !== undefined) {
    data.phone = String(data.phone || '').trim();
    if (!data.phone) return { error: 'Phone is required' };
  }

  if (data.role !== undefined && !['Trainer', 'Staff'].includes(data.role)) {
    return { error: 'Role must be Trainer or Staff' };
  }

  if (
    data.status !== undefined &&
    !['Active', 'Inactive'].includes(data.status)
  ) {
    return { error: 'Status must be Active or Inactive' };
  }

  if (data.email !== undefined) {
    data.email = String(data.email).trim().toLowerCase();
  }

  if (data.specialization !== undefined) {
    data.specialization = String(data.specialization).trim();
  }

  return { data };
};

exports.listTrainerStaff = async (req, res) => {
  try {
    const filter = { tenantId: req.tenantId };
    if (['Trainer', 'Staff'].includes(req.query.role)) {
      filter.role = req.query.role;
    }
    if (['Active', 'Inactive'].includes(req.query.status)) {
      filter.status = req.query.status;
    }

    const staff = await TrainerStaff.find(filter)
      .sort({ createdAt: -1 })
      .limit(250)
      .lean();

    return res.json({ success: true, staff });
  } catch (error) {
    console.error('List trainer/staff error:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to load trainers and staff'
    });
  }
};

exports.createTrainerStaff = async (req, res) => {
  try {
    const { data, error } = validateAndBuild(req.body, true);
    if (error || !['Trainer', 'Staff'].includes(data?.role)) {
      return res.status(400).json({
        success: false,
        message: error || 'Role is required'
      });
    }

    const staff = await TrainerStaff.create({
      ...data,
      tenantId: req.tenantId,
      createdBy: req.owner._id
    });

    return res.status(201).json({ success: true, staff });
  } catch (error) {
    console.error('Create trainer/staff error:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to create trainer or staff record'
    });
  }
};

exports.updateTrainerStaff = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid staff ID' });
    }
    const { data, error } = validateAndBuild(req.body, false);
    if (error) {
      return res.status(400).json({ success: false, message: error });
    }
    const staff = await TrainerStaff.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      { $set: data },
      { new: true, runValidators: true }
    );
    if (!staff) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }
    return res.json({ success: true, staff });
  } catch (error) {
    console.error('Update trainer/staff error:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to update trainer or staff record'
    });
  }
};

exports.deleteTrainerStaff = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid staff ID' });
    }
    const staff = await TrainerStaff.findOneAndDelete({
      _id: req.params.id,
      tenantId: req.tenantId
    });
    if (!staff) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }
    return res.json({ success: true, message: 'Record deleted' });
  } catch (error) {
    console.error('Delete trainer/staff error:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to delete trainer or staff record'
    });
  }
};
