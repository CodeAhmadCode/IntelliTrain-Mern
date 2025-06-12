// middleware/validate.js
const { check, validationResult } = require('express-validator');

// Validation for registration
exports.validateRegister = [
  check('email', 'Please include a valid email').isEmail(),
  check(
    'password',
    'Please enter a password with 8 or more characters'
  ).isLength({ min: 8 }),
  check('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.password) {
      throw new Error('Passwords do not match');
    }
    return true;
  })
];

// Validation for login
exports.validateLogin = [
  check('email', 'Please include a valid email').isEmail(),
  check('password', 'Password is required').exists()
];

// Handle validation errors
exports.handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};