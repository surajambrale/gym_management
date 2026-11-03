const mongoose = require('mongoose');

const biometricEnrollmentSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Business',
      required: true
    },

    memberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Member',
      required: true
    },

    templateFormat: {
      type: String,
      trim: true,
      maxlength: 128,
      required() {
        return this.enrollmentStatus === 'enrolled';
      }
    },

    templateCiphertext: {
      type: Buffer,
      select: false,
      required() {
        return this.enrollmentStatus === 'enrolled';
      },
      validate: {
        validator(value) {
          return !value || value.length > 0;
        },
        message: 'Encrypted fingerprint template cannot be empty'
      }
    },

    templateIv: {
      type: Buffer,
      select: false,
      required() {
        return this.enrollmentStatus === 'enrolled';
      },
      validate: {
        validator(value) {
          return !value || value.length === 12;
        },
        message: 'Fingerprint template IV must be 12 bytes'
      }
    },

    templateAuthTag: {
      type: Buffer,
      select: false,
      required() {
        return this.enrollmentStatus === 'enrolled';
      },
      validate: {
        validator(value) {
          return !value || value.length === 16;
        },
        message: 'Fingerprint template authentication tag must be 16 bytes'
      }
    },

    templateKeyVersion: {
      type: String,
      select: false,
      required() {
        return this.enrollmentStatus === 'enrolled';
      }
    },

    fingerIdentifier: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      minlength: 1,
      maxlength: 64
    },

    consentedAt: {
      type: Date,
      default: null,
      required() {
        return this.enrollmentStatus === 'enrolled';
      }
    },

    consentRecordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Owner',
      required() {
        return this.enrollmentStatus === 'enrolled';
      }
    },

    consentNoticeVersion: {
      type: String,
      trim: true,
      maxlength: 64,
      required() {
        return this.enrollmentStatus === 'enrolled';
      }
    },

    enrollmentStatus: {
      type: String,
      enum: ['pending', 'enrolled', 'revoked', 'failed'],
      default: 'pending',
      required: true
    },

    enrolledAt: {
      type: Date,
      default: null,
      required() {
        return this.enrollmentStatus === 'enrolled';
      }
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform: omitTemplatePayload
    },
    toObject: {
      transform: omitTemplatePayload
    }
  }
);

function omitTemplatePayload(_document, result) {
  delete result.templateCiphertext;
  delete result.templateIv;
  delete result.templateAuthTag;
  delete result.templateKeyVersion;
  return result;
}

biometricEnrollmentSchema.pre('validate', function validateTemplateState() {
  if (this.enrollmentStatus === 'enrolled') {
    return;
  }

  const protectedFields = [
    'templateCiphertext',
    'templateIv',
    'templateAuthTag',
    'templateKeyVersion'
  ];

  protectedFields.forEach((field) => {
    if (this[field] !== undefined && this[field] !== null) {
      this.invalidate(
        field,
        'Encrypted template data is only allowed for enrolled records'
      );
    }
  });
});

biometricEnrollmentSchema.index(
  { tenantId: 1, memberId: 1, fingerIdentifier: 1 },
  {
    unique: true,
    partialFilterExpression: { enrollmentStatus: 'enrolled' }
  }
);
biometricEnrollmentSchema.index({ tenantId: 1, enrollmentStatus: 1 });

module.exports = mongoose.model(
  'BiometricEnrollment',
  biometricEnrollmentSchema
);
