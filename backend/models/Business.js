const mongoose = require('mongoose');

const businessSchema = new mongoose.Schema(
  {
    businessName: {
      type: String,
      required: true,
      trim: true
    },

    businessType: {
      type: String,
      enum: [
        'Gym',
        'Dance Academy',
        'Yoga Studio',
        'Fitness Studio',
        'Other'
      ],
      required: true
    },

    ownerName: {
      type: String,
      required: true,
      trim: true
    },

    phone: {
      type: String,
      required: true,
      trim: true
    },

    email: {
      type: String,
      lowercase: true,
      trim: true
    },

    address: {
      type: String,
      trim: true
    },

    status: {
      type: String,
      enum: ['Active', 'Inactive', 'Suspended'],
      default: 'Active'
    },

    subscriptionStatus: {
      type: String,
      enum: ['Trial', 'Active', 'Expired', 'Cancelled'],
      default: 'Trial'
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Business', businessSchema);