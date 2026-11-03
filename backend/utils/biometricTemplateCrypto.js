const crypto = require('node:crypto');
const config = require('../config/env');

const algorithm = 'aes-256-gcm';
const ivLength = 12;
const authTagLength = 16;

const getEncryptionKeyring = () => {
  if (!config.biometricEncryptionKeys) {
    throw new Error('BIOMETRIC_ENCRYPTION_KEYS is not configured');
  }

  let encodedKeys;

  try {
    encodedKeys = JSON.parse(config.biometricEncryptionKeys);
  } catch (error) {
    throw new Error(
      'BIOMETRIC_ENCRYPTION_KEYS must be a JSON object of versioned base64 keys',
      { cause: error }
    );
  }

  if (
    !encodedKeys ||
    typeof encodedKeys !== 'object' ||
    Array.isArray(encodedKeys)
  ) {
    throw new Error('BIOMETRIC_ENCRYPTION_KEYS must be a JSON object');
  }

  const keys = new Map();

  Object.entries(encodedKeys).forEach(([version, encodedKey]) => {
    if (!/^[A-Za-z0-9._-]{1,64}$/.test(version) ||
        typeof encodedKey !== 'string') {
      throw new Error('Invalid biometric encryption key entry');
    }

    const key = Buffer.from(encodedKey, 'base64');

    if (
      key.length !== 32 ||
      key.toString('base64') !== encodedKey
    ) {
      throw new Error(
        `Biometric encryption key "${version}" must be canonical base64 for 32 bytes`
      );
    }

    keys.set(version, key);
  });

  const activeVersion = config.biometricEncryptionActiveKeyVersion;

  if (!activeVersion || !keys.has(activeVersion)) {
    throw new Error(
      'BIOMETRIC_ENCRYPTION_ACTIVE_KEY_VERSION must identify a configured key'
    );
  }

  return { keys, activeVersion };
};

const getAuthenticatedContext = (context) => {
  const fields = [
    'tenantId',
    'memberId',
    'fingerIdentifier',
    'templateFormat'
  ];

  const values = fields.map((field) => {
    const value = context?.[field];

    if (typeof value !== 'string' || !value.trim()) {
      throw new TypeError(`Biometric encryption context requires ${field}`);
    }

    return value.trim();
  });

  return Buffer.from(JSON.stringify(['biometric-template-v1', ...values]));
};

const encryptTemplate = (template, context) => {
  if (!Buffer.isBuffer(template) || template.length === 0) {
    throw new TypeError('Fingerprint template must be a non-empty Buffer');
  }

  const { keys, activeVersion } = getEncryptionKeyring();
  const iv = crypto.randomBytes(ivLength);
  const cipher = crypto.createCipheriv(
    algorithm,
    keys.get(activeVersion),
    iv,
    { authTagLength }
  );

  cipher.setAAD(getAuthenticatedContext(context));

  const templateCiphertext = Buffer.concat([
    cipher.update(template),
    cipher.final()
  ]);

  return {
    templateCiphertext,
    templateIv: iv,
    templateAuthTag: cipher.getAuthTag(),
    templateKeyVersion: activeVersion
  };
};

const decryptTemplate = (encryptedTemplate, context) => {
  const {
    templateCiphertext,
    templateIv,
    templateAuthTag,
    templateKeyVersion
  } = encryptedTemplate || {};

  if (
    !Buffer.isBuffer(templateCiphertext) ||
    templateCiphertext.length === 0 ||
    !Buffer.isBuffer(templateIv) ||
    templateIv.length !== ivLength ||
    !Buffer.isBuffer(templateAuthTag) ||
    templateAuthTag.length !== authTagLength ||
    typeof templateKeyVersion !== 'string'
  ) {
    throw new TypeError('Encrypted fingerprint template is incomplete');
  }

  const { keys } = getEncryptionKeyring();
  const key = keys.get(templateKeyVersion);

  if (!key) {
    throw new Error(
      `No biometric encryption key is configured for version "${templateKeyVersion}"`
    );
  }

  const decipher = crypto.createDecipheriv(
    algorithm,
    key,
    templateIv,
    { authTagLength }
  );

  decipher.setAAD(getAuthenticatedContext(context));
  decipher.setAuthTag(templateAuthTag);

  return Buffer.concat([
    decipher.update(templateCiphertext),
    decipher.final()
  ]);
};

module.exports = {
  encryptTemplate,
  decryptTemplate
};
