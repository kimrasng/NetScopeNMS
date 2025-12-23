/**
 * Metric Routes
 * 메트릭 데이터 조회 API 라우트
 */

const express = require('express');
const router = express.Router();
const metricController = require('../controllers/metricController');
const { authenticate } = require('../middleware/auth');
const { metricValidation } = require('../middleware/validation');

/**
 * @swagger
 * /metrics/dashboard:
 *   get:
 *     summary: 대시보드 요약 정보
 *     tags: [Metrics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 대시보드 요약 데이터
 */
router.get('/dashboard', authenticate, metricController.getDashboardSummary);

/**
 * @swagger
 * /metrics/devices/{deviceId}:
 *   get:
 *     summary: 장비 메트릭 조회
 *     tags: [Metrics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: deviceId
 *         required: true
 *         schema:
 *           type: integer
 *         description: 장비 ID
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [1h, 6h, 24h, 7d, 30d, 90d, custom]
 *           default: 24h
 *         description: 조회 기간
 *       - in: query
 *         name: interval
 *         schema:
 *           type: string
 *           enum: [raw, 5m, 1h, 1d, auto]
 *           default: auto
 *         description: 데이터 간격
 *       - in: query
 *         name: metrics
 *         schema:
 *           type: string
 *           default: cpu,memory,traffic_in,traffic_out
 *         description: 조회할 메트릭 (쉼표 구분)
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date-time
 *         description: 시작 시간 (custom 기간일 때)
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date-time
 *         description: 종료 시간 (custom 기간일 때)
 *     responses:
 *       200:
 *         description: 메트릭 데이터
 *       404:
 *         description: 장비를 찾을 수 없음
 */
router.get('/devices/:deviceId', authenticate, metricValidation.query, metricController.getDeviceMetrics);

/**
 * @swagger
 * /metrics/devices/{deviceId}/latest:
 *   get:
 *     summary: 장비 최신 메트릭 조회
 *     tags: [Metrics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: deviceId
 *         required: true
 *         schema:
 *           type: integer
 *         description: 장비 ID
 *     responses:
 *       200:
 *         description: 최신 메트릭 데이터
 */
router.get('/devices/:deviceId/latest', authenticate, metricController.getLatestMetrics);

/**
 * @swagger
 * /metrics/devices/{deviceId}/statistics:
 *   get:
 *     summary: 장비 메트릭 통계 조회
 *     tags: [Metrics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: deviceId
 *         required: true
 *         schema:
 *           type: integer
 *         description: 장비 ID
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [24h, 7d, 30d]
 *           default: 7d
 *         description: 통계 기간
 *     responses:
 *       200:
 *         description: 메트릭 통계
 */
router.get('/devices/:deviceId/statistics', authenticate, metricController.getMetricStatistics);

/**
 * @swagger
 * /metrics/devices/{deviceId}/export:
 *   get:
 *     summary: 메트릭 데이터 내보내기
 *     tags: [Metrics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: deviceId
 *         required: true
 *         schema:
 *           type: integer
 *         description: 장비 ID
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           default: 24h
 *         description: 내보내기 기간
 *       - in: query
 *         name: metrics
 *         schema:
 *           type: string
 *           default: cpu,memory,traffic_in,traffic_out
 *         description: 내보낼 메트릭
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [json, csv]
 *           default: json
 *         description: 출력 형식
 *     responses:
 *       200:
 *         description: 메트릭 데이터 파일
 */
router.get('/devices/:deviceId/export', authenticate, metricController.exportMetrics);

/**
 * @swagger
 * /metrics/interfaces/{interfaceId}:
 *   get:
 *     summary: 인터페이스 메트릭 조회
 *     tags: [Metrics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: interfaceId
 *         required: true
 *         schema:
 *           type: integer
 *         description: 인터페이스 ID
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [1h, 6h, 24h, 7d, 30d, 90d, custom]
 *           default: 24h
 *         description: 조회 기간
 *       - in: query
 *         name: interval
 *         schema:
 *           type: string
 *           enum: [raw, 5m, 1h, 1d, auto]
 *           default: auto
 *         description: 데이터 간격
 *     responses:
 *       200:
 *         description: 인터페이스 메트릭 데이터
 *       404:
 *         description: 인터페이스를 찾을 수 없음
 */
router.get('/interfaces/:interfaceId', authenticate, metricController.getInterfaceMetrics);

module.exports = router;
