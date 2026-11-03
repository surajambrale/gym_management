
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const config = require('./config/env');
const connectDB = require('./config/db');

const dns = require('node:dns');

dns.setServers([
  '1.1.1.1',
  '8.8.8.8'
]);

const app = express();

// Security Middleware
app.use(helmet());

// CORS Configuration
app.use(cors({
  origin: config.allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json());

// API Routes
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/members', require('./routes/memberRoutes'));
app.use('/api/membership-plans', require('./routes/membershipPlanRoutes'));
app.use('/api/attendance', require('./routes/attendanceRoutes'));

app.use(
  '/api/member-memberships',
  require('./routes/memberMembershipRoutes')
);
app.use('/api/trainers-staff', require('./routes/trainerStaffRoutes'));
app.use('/api/business', require('./routes/businessRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));

// Root Route
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'SS Fitness Manager API is running!'
  });
});

// Health Check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'Healthy',
    message: 'Backend server is working properly'
  });
});

// Start Server
const startServer = async () => {
  try {
    await connectDB();

    app.listen(config.port, () => {
      console.log(`Server running on port ${config.port}`);
    });
  } catch (error) {
    console.error('Server startup failed:', error.message);
    process.exit(1);
  }
};

startServer();
