// middleware/auth.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Protect routes
exports.protect = async (req, res, next) => {
  let token;

  // Get token from header or cookie
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies.token) {
    token = req.cookies.token;
  }

  // Make sure token exists
  if (!token) {
    return res.status(401).json({
      error: 'Not authorized to access this route'
    });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = await User.findById(decoded.id);

    // Check if user still exists
    if (!req.user) {
      return res.status(401).json({
        error: 'The user belonging to this token no longer exists'
      });
    }

    // Check if user changed password after the token was issued
    if (req.user.changedPasswordAfter(decoded.iat)) {
      return res.status(401).json({
        error: 'User recently changed password! Please log in again'
      });
    }

    next();
  } catch (err) {
    return res.status(401).json({
      error: 'Not authorized to access this route'
    });
  }
};

// Grant access to specific roles
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: `User role ${req.user.role} is not authorized to access this route`
      });
    }
    next();
  };
};