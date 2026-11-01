const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const Owner = require('../models/Owner');
const Business = require('../models/Business');
const config = require('../config/env');

// Generate JWT
const generateToken = (owner) => {
  return jwt.sign(
    {
      ownerId: owner._id,
      tenantId: owner.tenantId,
      role: owner.role
    },
    config.jwtSecret,
    { expiresIn: '7d' }
  );
};

// OWNER REGISTRATION
exports.registerOwner = async (req, res) => {
  let createdBusiness;

  try {
    const {
      name,
      email,
      phone,
      password,
      businessName,
      businessType,
      address
    } = req.body;

    if (
      !name || !email || !phone || !password ||
      !businessName || !businessType
    ) {
      return res.status(400).json({
        success: false,
        message: 'Please fill all required fields'
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters'
      });
    }

    const validBusinessTypes = [
      'Gym',
      'Dance Academy',
      'Yoga Studio',
      'Fitness Studio',
      'Other'
    ];

    if (!validBusinessTypes.includes(businessType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid business type'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingOwner = await Owner.findOne({
      email: normalizedEmail
    });

    if (existingOwner) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    // Create Business
    createdBusiness = await Business.create({
      businessName,
      businessType,
      ownerName: name,
      phone,
      email: normalizedEmail,
      address
    });

    // Create Owner
    const owner = await Owner.create({
      name,
      email: normalizedEmail,
      phone,
      password: hashedPassword,
      businessId: createdBusiness._id,
      tenantId: createdBusiness._id
    });

    const token = generateToken(owner);

    return res.status(201).json({
      success: true,
      message: 'Registration successful',
      token,
      owner: {
        id: owner._id,
        name: owner.name,
        email: owner.email,
        phone: owner.phone,
        businessId: owner.businessId,
        tenantId: owner.tenantId,
        role: owner.role
      },
      business: {
        id: createdBusiness._id,
        businessName: createdBusiness.businessName,
        businessType: createdBusiness.businessType
      }
    });

  } catch (error) {
    // Remove business if owner creation failed
    if (createdBusiness) {
      await Business.findByIdAndDelete(createdBusiness._id);
    }

    console.error('Registration Error:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Registration failed'
    });
  }
};

// OWNER LOGIN
exports.loginOwner = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const owner = await Owner.findOne({
      email: normalizedEmail
    }).select('+password');

    if (!owner) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    if (!owner.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account is inactive'
      });
    }

    const isPasswordValid = await bcrypt.compare(
      password,
      owner.password
    );

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const business = await Business.findById(owner.businessId);

    if (!business || business.status !== 'Active') {
      return res.status(403).json({
        success: false,
        message: 'Business account is unavailable'
      });
    }

    const token = generateToken(owner);

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      owner: {
        id: owner._id,
        name: owner.name,
        email: owner.email,
        phone: owner.phone,
        tenantId: owner.tenantId,
        role: owner.role
      },
      business: {
        id: business._id,
        businessName: business.businessName,
        businessType: business.businessType
      }
    });

  } catch (error) {
    console.error('Login Error:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Login failed'
    });
  }
};

// GET OWNER PROFILE
exports.getProfile = async (req, res) => {
  try {
    // Owner is already verified by authMiddleware
    const owner = req.owner;

    if (!owner) {
      return res.status(401).json({
        success: false,
        message: 'Owner authentication failed'
      });
    }

    const business = await Business.findById(owner.businessId);

    if (!business || business.status !== 'Active') {
      return res.status(403).json({
        success: false,
        message: 'Business account is unavailable'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Profile fetched successfully',

      owner: {
        id: owner._id,
        name: owner.name,
        email: owner.email,
        phone: owner.phone,
        businessId: owner.businessId,
        tenantId: owner.tenantId,
        role: owner.role
      },

      business: {
        id: business._id,
        businessName: business.businessName,
        businessType: business.businessType,
        address: business.address
      }
    });

  } catch (error) {
    console.error('Profile Error:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to fetch profile'
    });
  }
};