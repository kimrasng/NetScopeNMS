/**
 * Alarm Routes
 * 알람 및 알람 규칙 관리 API 라우트
 */

const express = require('express');
const router = express.Router();
const alarmController = require('../controllers/alarmController');
const { authenticate, authorize } = require('../middleware/auth');
const { alarmValidation, alarmRuleValidation, idParam } = require('../middleware/validation');

// ==================== 알람 관리 ====================

/**
 * @swagger
 * /alarms/summary:
 *   get:
 *     summary: 알람 요약 통계
 *     tags: [Alarms]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 알람 통계 요약
 */
router.get('/summary', authenticate, alarmController.getAlarmSummary);

/**
 * @swagger
 * /alarms/bulk-acknowledge:
 *   patch:
 *     summary: 알람 일괄 확인 처리
 *     tags: [Alarms]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - alarmIds
 *             properties:
 *               alarmIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *               note:
 *                 type: string
 *     responses:
 *       200:
 *         description: 일괄 확인 처리 완료
 */
router.patch('/bulk-acknowledge', authenticate, authorize('admin', 'user'), alarmController.bulkAcknowledgeAlarms);

/**
 * @swagger
 * /alarms/bulk-resolve:
 *   patch:
 *     summary: 알람 일괄 해결 처리
 *     tags: [Alarms]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - alarmIds
 *             properties:
 *               alarmIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *               note:
 *                 type: string
 *     responses:
 *       200:
 *         description: 일괄 해결 처리 완료
 */
router.patch('/bulk-resolve', authenticate, authorize('admin', 'user'), alarmController.bulkResolveAlarms);

/**
 * @swagger
 * /alarms:
 *   get:
 *     summary: 알람 목록 조회
 *     tags: [Alarms]
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
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, acknowledged, resolved, all]
 *       - in: query
 *         name: severity
 *         schema:
 *           type: string
 *           enum: [info, warning, critical]
 *       - in: query
 *         name: deviceId
 *         schema:
 *           type: integer
 *       - in: query
 *         name: metricType
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 알람 목록
 */
router.get('/', authenticate, alarmValidation.list, alarmController.getAlarms);

/**
 * @swagger
 * /alarms/{id}:
 *   get:
 *     summary: 알람 상세 조회
 *     tags: [Alarms]
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
 *         description: 알람 상세 정보
 *       404:
 *         description: 알람을 찾을 수 없음
 */
router.get('/:id', authenticate, idParam, alarmController.getAlarmById);

/**
 * @swagger
 * /alarms/{id}/acknowledge:
 *   patch:
 *     summary: 알람 확인 처리
 *     tags: [Alarms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               note:
 *                 type: string
 *                 description: 확인 메모
 *     responses:
 *       200:
 *         description: 확인 처리 완료
 */
router.patch('/:id/acknowledge', authenticate, authorize('admin', 'user'), idParam, alarmController.acknowledgeAlarm);

/**
 * @swagger
 * /alarms/{id}/resolve:
 *   patch:
 *     summary: 알람 해결 처리
 *     tags: [Alarms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               note:
 *                 type: string
 *                 description: 해결 메모
 *     responses:
 *       200:
 *         description: 해결 처리 완료
 */
router.patch('/:id/resolve', authenticate, authorize('admin', 'user'), alarmValidation.resolve, alarmController.resolveAlarm);

// ==================== 알람 규칙 관리 ====================

/**
 * @swagger
 * /alarms/rules:
 *   get:
 *     summary: 알람 규칙 목록 조회
 *     tags: [Alarm Rules]
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
 *         name: isEnabled
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: 알람 규칙 목록
 */
router.get('/rules', authenticate, alarmController.getAlarmRules);

/**
 * @swagger
 * /alarms/rules/{id}:
 *   get:
 *     summary: 알람 규칙 상세 조회
 *     tags: [Alarm Rules]
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
 *         description: 알람 규칙 상세 정보
 */
router.get('/rules/:id', authenticate, idParam, alarmController.getAlarmRuleById);

/**
 * @swagger
 * /alarms/rules:
 *   post:
 *     summary: 알람 규칙 생성
 *     tags: [Alarm Rules]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AlarmRuleCreate'
 *     responses:
 *       201:
 *         description: 규칙 생성 성공
 */
router.post('/rules', authenticate, authorize('admin', 'user'), alarmRuleValidation.create, alarmController.createAlarmRule);

/**
 * @swagger
 * /alarms/rules/{id}:
 *   put:
 *     summary: 알람 규칙 수정
 *     tags: [Alarm Rules]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AlarmRuleUpdate'
 *     responses:
 *       200:
 *         description: 규칙 수정 성공
 */
router.put('/rules/:id', authenticate, authorize('admin', 'user'), alarmRuleValidation.update, alarmController.updateAlarmRule);

/**
 * @swagger
 * /alarms/rules/{id}:
 *   delete:
 *     summary: 알람 규칙 삭제
 *     tags: [Alarm Rules]
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
 *         description: 규칙 삭제 성공
 */
router.delete('/rules/:id', authenticate, authorize('admin'), idParam, alarmController.deleteAlarmRule);

/**
 * @swagger
 * /alarms/rules/{id}/toggle:
 *   patch:
 *     summary: 알람 규칙 활성화/비활성화 토글
 *     tags: [Alarm Rules]
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
 *         description: 토글 성공
 */
router.patch('/rules/:id/toggle', authenticate, authorize('admin', 'user'), idParam, alarmController.toggleAlarmRule);

module.exports = router;
