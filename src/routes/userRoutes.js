const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate, adminOnly, authorize } = require('../middleware/auth');
const { userValidation, idParam } = require('../middleware/validation');

router.post('/register', userValidation.register, userController.register);

/**
 * @swagger
 * /users/login:
 *   post:
 *     summary: 로그인
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: 로그인 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *                     token:
 *                       type: string
 *       401:
 *         description: 인증 실패
 */
router.post('/login', userValidation.login, userController.login);

// ==================== 프로필 (인증 필요) ====================

/**
 * @swagger
 * /users/me:
 *   get:
 *     summary: 현재 사용자 프로필 조회
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 프로필 정보
 */
router.get('/me', authenticate, userController.getProfile);

/**
 * @swagger
 * /users/me:
 *   put:
 *     summary: 프로필 수정
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: 프로필 수정 성공
 */
router.put('/me', authenticate, userController.updateProfile);

/**
 * @swagger
 * /users/me/password:
 *   put:
 *     summary: 비밀번호 변경
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: 비밀번호 변경 성공
 */
router.put('/me/password', authenticate, userValidation.changePassword, userController.changePassword);

/**
 * @swagger
 * /users/logout:
 *   post:
 *     summary: 로그아웃
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 로그아웃 성공
 */
router.post('/logout', authenticate, userController.logout);

// ==================== 관리자 기능 ====================

/**
 * @swagger
 * /users:
 *   get:
 *     summary: 사용자 목록 조회 (관리자)
 *     tags: [User Management]
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
 *         name: role
 *         schema:
 *           type: string
 *           enum: [admin, user, viewer]
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 사용자 목록
 */
router.get('/', authenticate, adminOnly, userController.getUsers);

/**
 * @swagger
 * /users:
 *   post:
 *     summary: 사용자 생성 (관리자)
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [admin, user, viewer]
 *     responses:
 *       201:
 *         description: 사용자 생성 성공
 */
router.post('/', authenticate, adminOnly, userValidation.register, userController.createUser);

/**
 * @swagger
 * /users/{id}:
 *   get:
 *     summary: 사용자 상세 조회 (관리자)
 *     tags: [User Management]
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
 *         description: 사용자 상세 정보
 */
router.get('/:id', authenticate, adminOnly, idParam, userController.getUserById);

/**
 * @swagger
 * /users/{id}:
 *   put:
 *     summary: 사용자 수정 (관리자)
 *     tags: [User Management]
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
 *               username:
 *                 type: string
 *               email:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [admin, user, viewer]
 *               is_active:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: 사용자 수정 성공
 */
router.put('/:id', authenticate, adminOnly, userValidation.update, userController.updateUser);

/**
 * @swagger
 * /users/{id}:
 *   delete:
 *     summary: 사용자 삭제 (관리자)
 *     tags: [User Management]
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
 *         description: 사용자 삭제 성공
 */
router.delete('/:id', authenticate, adminOnly, idParam, userController.deleteUser);

/**
 * @swagger
 * /users/{id}/toggle:
 *   patch:
 *     summary: 사용자 활성화/비활성화 (관리자)
 *     tags: [User Management]
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
router.patch('/:id/toggle', authenticate, adminOnly, idParam, userController.toggleUserStatus);

/**
 * @swagger
 * /users/{id}/reset-password:
 *   post:
 *     summary: 비밀번호 초기화 (관리자)
 *     tags: [User Management]
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
 *             type: object
 *             required:
 *               - newPassword
 *             properties:
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: 비밀번호 초기화 성공
 */
router.post('/:id/reset-password', authenticate, adminOnly, idParam, userController.resetUserPassword);

module.exports = router;
