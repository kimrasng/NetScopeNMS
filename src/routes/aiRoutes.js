const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const { authenticate, authorize, adminOnly } = require('../middleware/auth');
const { aiValidation, idParam } = require('../middleware/validation');

/**
 * @swagger
 * /ai/statistics:
 *   get:
 *     summary: AI 분석 통계 조회
 *     tags: [AI Analysis]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [24h, 7d, 30d]
 *           default: 7d
 *         description: 통계 기간
 *     responses:
 *       200:
 *         description: AI 분석 통계
 */
router.get('/statistics', authenticate, aiController.getAnalysisStatistics);

/**
 * @swagger
 * /ai/history:
 *   get:
 *     summary: AI 분석 이력 조회
 *     tags: [AI Analysis]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: deviceId
 *         schema:
 *           type: integer
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [alarm_rca, prediction, daily_report, weekly_report, anomaly_detection]
 *     responses:
 *       200:
 *         description: 분석 이력 목록
 */
router.get('/history', authenticate, aiValidation.history, aiController.getAnalysisHistory);

/**
 * @swagger
 * /ai/history/{id}:
 *   get:
 *     summary: AI 분석 상세 조회
 *     tags: [AI Analysis]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 분석 결과 상세
 *       404:
 *         description: 분석 결과를 찾을 수 없음
 */
router.get('/history/:id', authenticate, idParam, aiController.getAnalysisById);

/**
 * @swagger
 * /ai/history/{id}:
 *   delete:
 *     summary: AI 분석 결과 삭제
 *     tags: [AI Analysis]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 삭제 성공
 */
router.delete('/history/:id', authenticate, authorize('admin'), idParam, aiController.deleteAnalysis);

/**
 * @swagger
 * /ai/devices/{deviceId}/analyze:
 *   post:
 *     summary: 장비 AI 분석 요청
 *     tags: [AI Analysis]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: deviceId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               forceRefresh:
 *                 type: boolean
 *                 default: false
 *                 description: 캐시 무시 여부
 *     responses:
 *       200:
 *         description: 분석 결과
 */
router.post('/devices/:deviceId/analyze', authenticate, authorize('admin', 'user'), aiValidation.analyze, aiController.analyzeDevice);

/**
 * @swagger
 * /ai/devices/{deviceId}/predict:
 *   post:
 *     summary: 장비 예측 분석
 *     tags: [AI Analysis]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: deviceId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 예측 결과
 */
router.post('/devices/:deviceId/predict', authenticate, authorize('admin', 'user'), aiValidation.analyze, aiController.predictDevice);

/**
 * @swagger
 * /ai/alarms/{alarmId}/analyze:
 *   post:
 *     summary: 알람 근본 원인 분석
 *     tags: [AI Analysis]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: alarmId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 알람 분석 결과
 */
router.post('/alarms/:alarmId/analyze', authenticate, authorize('admin', 'user'), aiController.analyzeAlarm);

/**
 * @swagger
 * /ai/reports/daily:
 *   post:
 *     summary: 일일 리포트 생성
 *     tags: [AI Reports]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 일일 리포트
 */
router.post('/reports/daily', authenticate, authorize('admin', 'user'), aiController.generateDailyReport);

/**
 * @swagger
 * /ai/reports/weekly:
 *   post:
 *     summary: 주간 리포트 생성
 *     tags: [AI Reports]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 주간 리포트
 */
router.post('/reports/weekly', authenticate, authorize('admin', 'user'), aiController.generateWeeklyReport);

/**
 * @swagger
 * /ai/predict-all:
 *   post:
 *     summary: 전체 장비 예측 분석 실행
 *     tags: [AI Analysis]
 *     security:
 *       - bearerAuth: []
 *     description: 관리자만 실행 가능. 모든 활성 장비에 대해 예측 분석을 실행합니다.
 *     responses:
 *       200:
 *         description: 전체 예측 결과
 */
router.post('/predict-all', authenticate, adminOnly, aiController.predictAllDevices);

/**
 * @swagger
 * /ai/cache/clear:
 *   post:
 *     summary: AI 분석 캐시 초기화
 *     tags: [AI Analysis]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               deviceId:
 *                 type: integer
 *                 description: 특정 장비 캐시만 초기화
 *               type:
 *                 type: string
 *                 description: 특정 분석 타입 캐시만 초기화
 *     responses:
 *       200:
 *         description: 캐시 초기화 완료
 */
router.post('/cache/clear', authenticate, adminOnly, aiController.clearAnalysisCache);

module.exports = router;
