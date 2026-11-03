const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const testKey = Buffer.alloc(32, 0x42).toString('base64');
process.env.MONGODB_URI = 'mongodb://127.0.0.1/biometric-test';
process.env.JWT_SECRET = 'test-only-jwt-secret';
process.env.BIOMETRIC_ENCRYPTION_KEYS = JSON.stringify({ test: testKey });
process.env.BIOMETRIC_ENCRYPTION_ACTIVE_KEY_VERSION = 'test';

const BiometricEnrollment = require('../models/BiometricEnrollment');
const {
  encryptTemplate,
  decryptTemplate
} = require('../utils/biometricTemplateCrypto');

const context = {
  tenantId: 'tenant-1',
  memberId: 'member-1',
  fingerIdentifier: 'left-thumb',
  templateFormat: 'vendor-format-v1'
};

test('encrypts and decrypts template bytes with tenant/member context', () => {
  const template = Buffer.from('non-biometric encryption test bytes');
  const encrypted = encryptTemplate(template, context);

  assert.deepEqual(decryptTemplate(encrypted, context), template);
  assert.equal(encrypted.templateKeyVersion, 'test');
  assert.notDeepEqual(encrypted.templateCiphertext, template);
});

test('uses a fresh IV for each encryption', () => {
  const template = Buffer.from('non-biometric encryption test bytes');
  const first = encryptTemplate(template, context);
  const second = encryptTemplate(template, context);

  assert.notDeepEqual(first.templateIv, second.templateIv);
  assert.notDeepEqual(first.templateCiphertext, second.templateCiphertext);
});

test('rejects tampered ciphertext and mismatched tenant context', () => {
  const encrypted = encryptTemplate(
    Buffer.from('non-biometric encryption test bytes'),
    context
  );
  const tampered = {
    ...encrypted,
    templateCiphertext: Buffer.from(encrypted.templateCiphertext)
  };
  tampered.templateCiphertext[0] ^= 0x01;

  assert.throws(() => decryptTemplate(tampered, context));
  assert.throws(() =>
    decryptTemplate(encrypted, { ...context, tenantId: 'another-tenant' })
  );
});

test('rejects missing encryption context and empty template bytes', () => {
  assert.throws(
    () => encryptTemplate(Buffer.from('template'), {}),
    /tenantId/
  );
  assert.throws(
    () => encryptTemplate(Buffer.alloc(0), context),
    /non-empty Buffer/
  );
});

test('requires complete encrypted payload for enrolled records', async () => {
  const enrollment = new BiometricEnrollment({
    tenantId: new mongoose.Types.ObjectId(),
    memberId: new mongoose.Types.ObjectId(),
    fingerIdentifier: 'left-thumb',
    enrollmentStatus: 'enrolled',
    enrolledAt: new Date()
  });

  await assert.rejects(enrollment.validate(), (error) => {
    assert.ok(error.errors.templateCiphertext);
    assert.ok(error.errors.templateIv);
    assert.ok(error.errors.templateAuthTag);
    assert.ok(error.errors.templateKeyVersion);
    assert.ok(error.errors.consentedAt);
    assert.ok(error.errors.consentRecordedBy);
    assert.ok(error.errors.consentNoticeVersion);
    return true;
  });
});

test('accepts a complete encrypted enrollment with recorded consent', async () => {
  const tenantId = new mongoose.Types.ObjectId();
  const memberId = new mongoose.Types.ObjectId();
  const encrypted = encryptTemplate(
    Buffer.from('non-biometric encryption test bytes'),
    {
      tenantId: tenantId.toString(),
      memberId: memberId.toString(),
      fingerIdentifier: 'left-thumb',
      templateFormat: 'vendor-format-v1'
    }
  );
  const enrollment = new BiometricEnrollment({
    tenantId,
    memberId,
    ...encrypted,
    templateFormat: 'vendor-format-v1',
    fingerIdentifier: 'LEFT-THUMB',
    enrollmentStatus: 'enrolled',
    enrolledAt: new Date(),
    consentedAt: new Date(),
    consentRecordedBy: new mongoose.Types.ObjectId(),
    consentNoticeVersion: 'consent-v1'
  });

  await enrollment.validate();
  assert.equal(enrollment.fingerIdentifier, 'left-thumb');
});

test('omits encrypted template data from model serialization', () => {
  const encrypted = encryptTemplate(
    Buffer.from('non-biometric encryption test bytes'),
    context
  );
  const enrollment = new BiometricEnrollment({
    ...context,
    tenantId: new mongoose.Types.ObjectId(),
    memberId: new mongoose.Types.ObjectId(),
    ...encrypted,
    enrollmentStatus: 'enrolled',
    enrolledAt: new Date()
  });
  const serialized = enrollment.toJSON();

  assert.equal(serialized.templateCiphertext, undefined);
  assert.equal(serialized.templateIv, undefined);
  assert.equal(serialized.templateAuthTag, undefined);
  assert.equal(serialized.templateKeyVersion, undefined);
});

test('marks encrypted fields unselected and finger slots uniquely indexed', () => {
  for (const field of [
    'templateCiphertext',
    'templateIv',
    'templateAuthTag',
    'templateKeyVersion'
  ]) {
    assert.equal(
      BiometricEnrollment.schema.path(field).options.select,
      false
    );
  }

  const fingerSlotIndex = BiometricEnrollment.schema.indexes().find(
    ([fields, options]) =>
      fields.tenantId === 1 &&
      fields.memberId === 1 &&
      fields.fingerIdentifier === 1 &&
      options.unique === true
  );

  assert.ok(fingerSlotIndex);
  assert.deepEqual(
    fingerSlotIndex[1].partialFilterExpression,
    { enrollmentStatus: 'enrolled' }
  );
});
