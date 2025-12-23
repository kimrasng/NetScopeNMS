/**
 * Device Routes
 * 장비 관리 API 라우트
 */

const express = require('express');
const router = express.Router();
const deviceController = require('../controllers/deviceController');
const { authenticate, authorize } = require('../middleware/auth');
const { deviceValidation } = require('../middleware/validation');

/**
 * @swagger
 * /devices/summary:
 *   get:
 *     summary: 장비 상태 요약
 *     tags: [Devices]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 장비 요약 정보
 */
router.get('/summary', authenticate, deviceController.getDeviceSummary);

/**
 * @swagger
 * /devices/test-connection:
 *   post:
 *     summary: 신규 장비 SNMP 연결 테스트
 *     tags: [Devices]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SnmpTestRequest'
 *     responses:
 *       200:
 *         description: 연결 테스트 결과
 */
router.post('/test-connection', authenticate, authorize('admin', 'user'), deviceController.testConnection);

/**
 * @swagger
 * /devices:
 *   get:
 *     summary: 장비 목록 조회
 *     tags: [Devices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: 페이지 번호
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: 페이지당 항목 수
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [up, down, warning, unknown, all]
 *         description: 상태 필터
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [router, switch, server, firewall, access_point, other, all]
 *         description: 장비 유형 필터
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: 검색어 (이름, IP, 위치)
 *     responses:
 *       200:
 *         description: 장비 목록
 */
router.get('/', authenticate, deviceController.getDevices);

/**
 * @swagger
 * /devices/{id}:
 *   get:
 *     summary: 장비 상세 조회
 *     tags: [Devices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 장비 ID
 *     responses:
 *       200:
 *         description: 장비 상세 정보
 *       404:
 *         description: 장비를 찾을 수 없음
 */
router.get('/:id', authenticate, deviceValidation.getById, deviceController.getDeviceById);

/**
 * @swagger
 * /devices:
 *   post:
 *     summary: 장비 등록
 *     tags: [Devices]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DeviceCreate'
 *     responses:
 *       201:
 *         description: 장비 등록 성공
 *       409:
 *         description: IP 주소 중복
 */
router.post('/', authenticate, authorize('admin', 'user'), deviceValidation.create, deviceController.createDevice);

/**
 * @swagger
 * /devices/{id}:
 *   put:
 *     summary: 장비 수정
 *     tags: [Devices]
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
 *             $ref: '#/components/schemas/DeviceUpdate'
 *     responses:
 *       200:
 *         description: 장비 수정 성공
 */
router.put('/:id', authenticate, authorize('admin', 'user'), deviceValidation.update, deviceController.updateDevice);

/**
 * @swagger
 * /devices/{id}:
 *   delete:
 *     summary: 장비 삭제
 *     tags: [Devices]
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
 *         description: 장비 삭제 성공
 */
router.delete('/:id', authenticate, authorize('admin'), deviceValidation.getById, deviceController.deleteDevice);

/**
 * @swagger
 * /devices/{id}/test-connection:
 *   post:
 *     summary: 기존 장비 SNMP 연결 테스트
 *     tags: [Devices]
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
 *         description: 연결 테스트 결과
 */
router.post('/:id/test-connection', authenticate, authorize('admin', 'user'), deviceValidation.getById, deviceController.testConnection);

/**
 * @swagger
 * /devices/{id}/discover-interfaces:
 *   post:
 *     summary: 장비 인터페이스 검색
 *     tags: [Devices]
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
 *         description: 검색된 인터페이스 목록
 */
router.post('/:id/discover-interfaces', authenticate, authorize('admin', 'user'), deviceValidation.getById, deviceController.discoverInterfaces);

/**
 * @swagger
 * /devices/{id}/interfaces:
 *   get:
 *     summary: 장비 인터페이스 목록 조회
 *     tags: [Devices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [up, down, testing, unknown, dormant]
 *     responses:
 *       200:
 *         description: 인터페이스 목록
 */
router.get('/:id/interfaces', authenticate, deviceValidation.getById, deviceController.getDeviceInterfaces);

/**
 * @swagger
 * /devices/{id}/toggle:
 *   patch:
 *     summary: 장비 활성화/비활성화 토글
 *     tags: [Devices]
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
router.patch('/:id/toggle', authenticate, authorize('admin', 'user'), deviceValidation.getById, deviceController.toggleDevice);

/**
 * @swagger
 * /devices/{id}/poll:
 *   post:
 *     summary: 수동 폴링 실행
 *     tags: [Devices]
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
 *         description: 폴링 결과
 */
router.post('/:id/poll', authenticate, authorize('admin', 'user'), deviceValidation.getById, deviceController.pollDevice);

module.exports = router;
