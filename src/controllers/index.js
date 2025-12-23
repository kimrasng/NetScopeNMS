/**
 * Controllers Index
 * 모든 컨트롤러 모듈 통합
 */

const deviceController = require('./deviceController');
const metricController = require('./metricController');
const alarmController = require('./alarmController');
const aiController = require('./aiController');
const userController = require('./userController');

module.exports = {
  deviceController,
  metricController,
  alarmController,
  aiController,
  userController,
};
