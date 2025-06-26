const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { validationResult } = require('express-validator');

const handleErrors = (err) => {
  let errors = { email: '', password: '' };

  if (err.code === 11000) {
    errors.email = 'That email is already registered';
    return errors;
  }

  if (err.message.includes('user validation failed')) {
    Object.values(err.errors).forEach(({ properties }) => {
      errors[properties.path] = properties.message;
    });
  }

  return errors;
};

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '1d'
  });
};

const cookieOptions = {
  expires: new Date(
    Date.now() + process.env.JWT_COOKIE_EXPIRE * 24 * 60 * 60 * 1000
  ),
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict'
};

exports.register = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    const user = await User.create({
      email,
      password
    });

    const token = generateToken(user._id);

    res.cookie('token', token, cookieOptions);

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        email: user.email
      }
    });
  } catch (err) {
    const errors = handleErrors(err);
    res.status(400).json({ errors });
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Please provide an email and password'
      });
    }

    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(401).json({
        error: 'Invalid credentials'
      });
    }

    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return res.status(401).json({
        error: 'Invalid credentials'
      });
    }

    const token = generateToken(user._id);

    res.cookie('token', token, cookieOptions);

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        email: user.email
      }
    });
  } catch (err) {
    res.status(500).json({
      error: 'Server error'
    });
  }
};

exports.logout = (req, res, next) => {
  res.cookie('token', 'none', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true
  });

  res.status(200).json({
    success: true,
    data: {}
  });
};

exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (err) {
    res.status(500).json({
      error: 'Server error'
    });
  }
};