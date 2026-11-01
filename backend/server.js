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

app.use(helmet());

app.use(cors({
  origin: config.allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
// Auth Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/members', require('./routes/memberRoutes'));
app.use('/api/membership-plans', require('./routes/membershipPlanRoutes'));
app.use('/api/attendance', require('./routes/attendanceRoutes'));

app.use(
  '/api/member-memberships',
  require('./routes/memberMembershipRoutes')
);

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'SS Fitness Manager API is running!'
  });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'Healthy',
    message: 'Backend server is working properly'
  });
});

const startServer = async () => {
  await connectDB();

  app.listen(config.port, () => {
    console.log(`Server running on port ${config.port}`);
  });
};

startServer();