const path = require('node:path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const requiredVariables = ['MONGODB_URI', 'JWT_SECRET'];
const missingVariables = requiredVariables.filter(
  (name) => !process.env[name]?.trim()
);

if (missingVariables.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missingVariables.join(', ')}`
  );
}

const port = Number(process.env.PORT || 5000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535');
}

const nodeEnv = process.env.NODE_ENV || 'development';
if (nodeEnv === 'production' && !process.env.FRONTEND_URL?.trim()) {
  throw new Error('FRONTEND_URL must be configured in production');
}

const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
const allowedOrigins = new Set([frontendUrl]);
if (nodeEnv !== 'production') {
  allowedOrigins.add('http://localhost:4200');
  allowedOrigins.add('http://localhost:60949');
}

module.exports = Object.freeze({
  port,
  nodeEnv,
  mongodbUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  frontendUrl,
  allowedOrigins: Object.freeze([...allowedOrigins]),
  backendUrl: process.env.BACKEND_URL || 'http://localhost:5000',
  razorpay: Object.freeze({
    keyId: process.env.RAZORPAY_KEY_ID || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || ''
  }),
  cloudinary: Object.freeze({
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
    uploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET || ''
  })
});
