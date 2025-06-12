// security.js
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');

// Set security HTTP headers
exports.setSecurityHeaders = helmet();

// Limit requests from same API
exports.limitRequests = rateLimit({
  max: 100,
  windowMs: 60 * 60 * 1000,
  message: 'Too many requests from this IP, please try again in an hour!'
});

// Data sanitization against NoSQL query injection
exports.sanitizeData = mongoSanitize();

// Data sanitization against XSS
exports.preventXSS = xss();

// Prevent parameter pollution
exports.preventParameterPollution = hpp({
  whitelist: [
    // Add parameters you want to allow duplicates for
  ]
});

// CSRF Protection
exports.csrfProtection = (req, res, next) => {
  res.locals.csrfToken = req.csrfToken();
  next();
};