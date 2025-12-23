const express = require('express');
const router = express.Router();

// Import route modules
const deviceRoutes = require('./deviceRoutes');
const metricRoutes = require('./metricRoutes');
const alarmRoutes = require('./alarmRoutes');
const aiRoutes = require('./aiRoutes');
const userRoutes = require('./userRoutes');

router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'NetScopeNMS API is running',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

router.use('/devices', deviceRoutes);
router.use('/metrics', metricRoutes);
router.use('/alarms', alarmRoutes);
router.use('/ai', aiRoutes);
router.use('/users', userRoutes);

router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'NetScopeNMS REST API',
    version: '1.0.0',
    endpoints: {
      devices: '/api/v1/devices',
      metrics: '/api/v1/metrics',
      alarms: '/api/v1/alarms',
      ai: '/api/v1/ai',
      users: '/api/v1/users',
      docs: '/api-docs',
    },
    documentation: 'https://github.com/kimrasng/NetScopeNMS',
  });
});

module.exports = router;
