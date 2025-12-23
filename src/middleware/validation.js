/**
 * Validation Middleware
 * Request validation using express-validator
 */

const { body, param, query, validationResult } = require('express-validator');
const { ApiError } = require('./errorHandler');

/**
 * Validation result handler
 * Checks for validation errors and throws ApiError if found
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const details = errors.array().map(err => ({
      field: err.path,
      message: err.msg,
      value: err.value,
    }));
    
    throw ApiError.badRequest('Validation failed', details);
  }
  
  next();
};

/**
 * Device validation rules
 */
const deviceValidation = {
  create: [
    body('name')
      .trim()
      .notEmpty().withMessage('Name is required')
      .isLength({ max: 100 }).withMessage('Name must be at most 100 characters'),
    body('ip_address')
      .notEmpty().withMessage('IP address is required')
      .isIP().withMessage('Invalid IP address format'),
    body('device_type')
      .optional()
      .isIn(['router', 'switch', 'server', 'firewall', 'access_point', 'other'])
      .withMessage('Invalid device type'),
    body('snmp_version')
      .optional()
      .isIn(['1', '2c', '3'])
      .withMessage('Invalid SNMP version'),
    body('snmp_port')
      .optional()
      .isInt({ min: 1, max: 65535 })
      .withMessage('Port must be between 1 and 65535'),
    body('poll_interval')
      .optional()
      .isInt({ min: 30, max: 3600 })
      .withMessage('Poll interval must be between 30 and 3600 seconds'),
    body('location')
      .optional()
      .trim()
      .isLength({ max: 200 }).withMessage('Location must be at most 200 characters'),
    validate,
  ],
  
  update: [
    param('id').isInt().withMessage('Invalid device ID'),
    body('name')
      .optional()
      .trim()
      .isLength({ min: 1, max: 100 }).withMessage('Name must be between 1 and 100 characters'),
    body('ip_address')
      .optional()
      .isIP().withMessage('Invalid IP address format'),
    body('device_type')
      .optional()
      .isIn(['router', 'switch', 'server', 'firewall', 'access_point', 'other'])
      .withMessage('Invalid device type'),
    validate,
  ],
  
  getById: [
    param('id').isInt().withMessage('Invalid device ID'),
    validate,
  ],
};

/**
 * SNMP credential validation rules
 */
const snmpCredentialValidation = {
  v1v2c: [
    body('community')
      .notEmpty().withMessage('Community string is required')
      .isLength({ max: 255 }).withMessage('Community string too long'),
    validate,
  ],
  
  v3: [
    body('username')
      .notEmpty().withMessage('Username is required')
      .isLength({ max: 100 }).withMessage('Username too long'),
    body('security_level')
      .notEmpty().withMessage('Security level is required')
      .isIn(['noAuthNoPriv', 'authNoPriv', 'authPriv'])
      .withMessage('Invalid security level'),
    body('auth_protocol')
      .if(body('security_level').isIn(['authNoPriv', 'authPriv']))
      .notEmpty().withMessage('Auth protocol required for this security level')
      .isIn(['MD5', 'SHA', 'SHA-256', 'SHA-384', 'SHA-512'])
      .withMessage('Invalid auth protocol'),
    body('auth_password')
      .if(body('security_level').isIn(['authNoPriv', 'authPriv']))
      .notEmpty().withMessage('Auth password required')
      .isLength({ min: 8 }).withMessage('Auth password must be at least 8 characters'),
    body('priv_protocol')
      .if(body('security_level').equals('authPriv'))
      .notEmpty().withMessage('Privacy protocol required for authPriv')
      .isIn(['DES', 'AES', 'AES-128', 'AES-192', 'AES-256'])
      .withMessage('Invalid privacy protocol'),
    body('priv_password')
      .if(body('security_level').equals('authPriv'))
      .notEmpty().withMessage('Privacy password required')
      .isLength({ min: 8 }).withMessage('Privacy password must be at least 8 characters'),
    validate,
  ],
};

/**
 * Metric query validation rules
 */
const metricValidation = {
  query: [
    param('deviceId').isInt().withMessage('Invalid device ID'),
    query('period')
      .optional()
      .isIn(['1h', '6h', '24h', '7d', '30d', '90d', 'custom'])
      .withMessage('Invalid period'),
    query('interval')
      .optional()
      .isIn(['raw', '5m', '1h', '1d', 'auto'])
      .withMessage('Invalid interval'),
    query('metrics')
      .optional()
      .custom((value) => {
        const validMetrics = ['cpu', 'memory', 'traffic_in', 'traffic_out', 'bandwidth_util', 'errors_in', 'errors_out'];
        const metrics = value.split(',');
        return metrics.every(m => validMetrics.includes(m));
      })
      .withMessage('Invalid metric type'),
    query('from')
      .optional()
      .isISO8601().withMessage('Invalid from date'),
    query('to')
      .optional()
      .isISO8601().withMessage('Invalid to date'),
    validate,
  ],
};

/**
 * Alarm validation rules
 */
const alarmValidation = {
  list: [
    query('status')
      .optional()
      .isIn(['active', 'acknowledged', 'resolved', 'all'])
      .withMessage('Invalid status'),
    query('severity')
      .optional()
      .isIn(['info', 'warning', 'critical'])
      .withMessage('Invalid severity'),
    query('deviceId')
      .optional()
      .isInt()
      .withMessage('Invalid device ID'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 1000 })
      .withMessage('Limit must be between 1 and 1000'),
    validate,
  ],
  
  resolve: [
    param('id').isInt().withMessage('Invalid alarm ID'),
    body('note')
      .optional()
      .trim()
      .isLength({ max: 1000 }).withMessage('Note too long'),
    validate,
  ],
};

/**
 * Alarm rule validation
 */
const alarmRuleValidation = {
  create: [
    body('name')
      .trim()
      .notEmpty().withMessage('Name is required')
      .isLength({ max: 100 }).withMessage('Name too long'),
    body('metric_type')
      .notEmpty().withMessage('Metric type is required')
      .isIn(['cpu', 'memory', 'traffic_in', 'traffic_out', 'bandwidth_util', 'errors_in', 'errors_out'])
      .withMessage('Invalid metric type'),
    body('condition_operator')
      .optional()
      .isIn(['gt', 'gte', 'lt', 'lte', 'eq', 'neq'])
      .withMessage('Invalid operator'),
    body('threshold_critical')
      .notEmpty().withMessage('Critical threshold is required')
      .isFloat().withMessage('Threshold must be a number'),
    body('threshold_warning')
      .optional()
      .isFloat().withMessage('Threshold must be a number'),
    body('duration_seconds')
      .optional()
      .isInt({ min: 0 }).withMessage('Duration must be non-negative'),
    validate,
  ],
  
  update: [
    param('id').isInt().withMessage('Invalid rule ID'),
    body('name')
      .optional()
      .trim()
      .isLength({ min: 1, max: 100 }).withMessage('Name must be between 1 and 100 characters'),
    body('threshold_critical')
      .optional()
      .isFloat().withMessage('Threshold must be a number'),
    validate,
  ],
};

/**
 * User validation rules
 */
const userValidation = {
  register: [
    body('username')
      .trim()
      .notEmpty().withMessage('Username is required')
      .isLength({ min: 3, max: 50 }).withMessage('Username must be 3-50 characters')
      .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username can only contain letters, numbers, and underscores'),
    body('email')
      .trim()
      .notEmpty().withMessage('Email is required')
      .isEmail().withMessage('Invalid email format')
      .normalizeEmail(),
    body('password')
      .notEmpty().withMessage('Password is required')
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password must contain uppercase, lowercase, and number'),
    body('role')
      .optional()
      .isIn(['admin', 'user', 'viewer'])
      .withMessage('Invalid role'),
    validate,
  ],
  
  login: [
    body('email')
      .trim()
      .notEmpty().withMessage('Email is required')
      .isEmail().withMessage('Invalid email format'),
    body('password')
      .notEmpty().withMessage('Password is required'),
    validate,
  ],
  
  update: [
    param('id').isInt().withMessage('Invalid user ID'),
    body('username')
      .optional()
      .trim()
      .isLength({ min: 3, max: 50 }).withMessage('Username must be 3-50 characters'),
    body('email')
      .optional()
      .isEmail().withMessage('Invalid email format'),
    body('role')
      .optional()
      .isIn(['admin', 'user', 'viewer'])
      .withMessage('Invalid role'),
    validate,
  ],
  
  changePassword: [
    body('currentPassword')
      .notEmpty().withMessage('Current password is required'),
    body('newPassword')
      .notEmpty().withMessage('New password is required')
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    validate,
  ],
};

/**
 * AI validation rules
 */
const aiValidation = {
  analyze: [
    param('deviceId').isInt().withMessage('Invalid device ID'),
    validate,
  ],
  
  history: [
    query('deviceId')
      .optional()
      .isInt()
      .withMessage('Invalid device ID'),
    query('type')
      .optional()
      .isIn(['alarm_rca', 'prediction', 'daily_report', 'weekly_report', 'anomaly_detection'])
      .withMessage('Invalid analysis type'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    validate,
  ],
};

/**
 * Common ID parameter validation
 */
const idParam = [
  param('id').isInt({ min: 1 }).withMessage('Invalid ID'),
  validate,
];

/**
 * Pagination validation
 */
const pagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  validate,
];

module.exports = {
  validate,
  deviceValidation,
  snmpCredentialValidation,
  metricValidation,
  alarmValidation,
  alarmRuleValidation,
  userValidation,
  aiValidation,
  idParam,
  pagination,
};
