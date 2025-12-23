const { User, AuditLog, sequelize } = require('../models');
const { generateToken } = require('../middleware/auth');
const { ApiError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

const register = async (req, res, next) => {
  try {
    const { username, email, password, role = 'viewer' } = req.body;

    // 이메일 중복 확인
    const existingEmail = await User.findOne({ where: { email } });
    if (existingEmail) {
      throw ApiError.conflict('이미 사용 중인 이메일입니다.');
    }

    // 사용자명 중복 확인
    const existingUsername = await User.findOne({ where: { username } });
    if (existingUsername) {
      throw ApiError.conflict('이미 사용 중인 사용자명입니다.');
    }

    // 첫 번째 사용자는 자동으로 admin 권한 부여
    const userCount = await User.count();
    const assignedRole = userCount === 0 ? 'admin' : role;

    // 사용자 생성
    const user = await User.create({
      username,
      email,
      password_hash: password, // Model hook에서 해시 처리
      role: assignedRole,
    });

    // 토큰 생성
    const token = generateToken(user);

    logger.info(`User registered: ${username}`, { userId: user.id });

    // 감사 로그
    await AuditLog.create({
      user_id: user.id,
      action: 'USER_REGISTER',
      resource_type: 'user',
      resource_id: user.id,
      details: { username, email, role: assignedRole },
    });

    res.status(201).json({
      success: true,
      message: '회원가입이 완료되었습니다.',
      data: {
        user: user.toPublicJSON(),
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // 사용자 확인
    const user = await User.findByCredentials(email, password);

    if (!user) {
      throw ApiError.unauthorized('이메일 또는 비밀번호가 올바르지 않습니다.');
    }

    // 마지막 로그인 시간 업데이트
    await user.update({ last_login: new Date() });

    // 토큰 생성
    const token = generateToken(user);

    logger.info(`User logged in: ${user.username}`, { userId: user.id });

    // 감사 로그
    await AuditLog.create({
      user_id: user.id,
      action: 'USER_LOGIN',
      resource_type: 'user',
      resource_id: user.id,
      ip_address: req.ip,
      user_agent: req.get('User-Agent'),
    });

    res.json({
      success: true,
      message: '로그인되었습니다.',
      data: {
        user: user.toPublicJSON(),
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 현재 사용자 프로필 조회
 * GET /api/v1/users/me
 */
const getProfile = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id);

    if (!user) {
      throw ApiError.notFound('사용자를 찾을 수 없습니다.');
    }

    res.json({
      success: true,
      message: '프로필 정보를 조회했습니다.',
      data: { user: user.toPublicJSON() },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 프로필 수정
 * PUT /api/v1/users/me
 */
const updateProfile = async (req, res, next) => {
  try {
    const { username, email } = req.body;
    const userId = req.user.id;

    const user = await User.findByPk(userId);

    if (!user) {
      throw ApiError.notFound('사용자를 찾을 수 없습니다.');
    }

    // 이메일 변경 시 중복 확인
    if (email && email !== user.email) {
      const existingEmail = await User.findOne({
        where: { email, id: { [Op.ne]: userId } },
      });
      if (existingEmail) {
        throw ApiError.conflict('이미 사용 중인 이메일입니다.');
      }
    }

    // 사용자명 변경 시 중복 확인
    if (username && username !== user.username) {
      const existingUsername = await User.findOne({
        where: { username, id: { [Op.ne]: userId } },
      });
      if (existingUsername) {
        throw ApiError.conflict('이미 사용 중인 사용자명입니다.');
      }
    }

    await user.update({ username, email });

    logger.info(`User profile updated: ${user.username}`, { userId });

    res.json({
      success: true,
      message: '프로필이 수정되었습니다.',
      data: { user: user.toPublicJSON() },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 비밀번호 변경
 * PUT /api/v1/users/me/password
 */
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    const user = await User.findByPk(userId);

    if (!user) {
      throw ApiError.notFound('사용자를 찾을 수 없습니다.');
    }

    // 현재 비밀번호 확인
    const isValid = await user.verifyPassword(currentPassword);
    if (!isValid) {
      throw ApiError.badRequest('현재 비밀번호가 올바르지 않습니다.');
    }

    // 비밀번호 업데이트
    await user.update({ password_hash: newPassword });

    logger.info(`User password changed: ${user.username}`, { userId });

    // 감사 로그
    await AuditLog.create({
      user_id: userId,
      action: 'PASSWORD_CHANGE',
      resource_type: 'user',
      resource_id: userId,
      ip_address: req.ip,
    });

    res.json({
      success: true,
      message: '비밀번호가 변경되었습니다.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 로그아웃 (토큰 무효화는 클라이언트에서 처리)
 * POST /api/v1/users/logout
 */
const logout = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // 감사 로그
    await AuditLog.create({
      user_id: userId,
      action: 'USER_LOGOUT',
      resource_type: 'user',
      resource_id: userId,
      ip_address: req.ip,
    });

    res.json({
      success: true,
      message: '로그아웃되었습니다.',
    });
  } catch (error) {
    next(error);
  }
};

// ==================== 관리자 기능 ====================

/**
 * 사용자 목록 조회 (관리자)
 * GET /api/v1/users
 */
const getUsers = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      role,
      isActive,
      search,
      sortBy = 'created_at',
      sortOrder = 'DESC',
    } = req.query;

    const offset = (page - 1) * limit;
    const where = {};

    if (role) {
      where.role = role;
    }
    if (isActive !== undefined) {
      where.is_active = isActive === 'true';
    }
    if (search) {
      where[Op.or] = [
        { username: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows: users } = await User.findAndCountAll({
      where,
      attributes: { exclude: ['password_hash'] },
      order: [[sortBy, sortOrder]],
      limit: parseInt(limit),
      offset,
    });

    res.json({
      success: true,
      message: '사용자 목록을 조회했습니다.',
      data: {
        users: users.map(u => u.toPublicJSON()),
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 사용자 상세 조회 (관리자)
 * GET /api/v1/users/:id
 */
const getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await User.findByPk(id, {
      attributes: { exclude: ['password_hash'] },
      include: [
        {
          model: AuditLog,
          as: 'auditLogs',
          limit: 10,
          order: [['created_at', 'DESC']],
        },
      ],
    });

    if (!user) {
      throw ApiError.notFound('사용자를 찾을 수 없습니다.');
    }

    res.json({
      success: true,
      message: '사용자 정보를 조회했습니다.',
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 사용자 생성 (관리자)
 * POST /api/v1/users
 */
const createUser = async (req, res, next) => {
  try {
    const { username, email, password, role = 'viewer' } = req.body;
    const adminId = req.user.id;

    // 중복 확인
    const existingUser = await User.findOne({
      where: { [Op.or]: [{ email }, { username }] },
    });

    if (existingUser) {
      throw ApiError.conflict(
        existingUser.email === email
          ? '이미 사용 중인 이메일입니다.'
          : '이미 사용 중인 사용자명입니다.'
      );
    }

    const user = await User.create({
      username,
      email,
      password_hash: password,
      role,
    });

    logger.info(`User created by admin: ${username}`, { adminId, userId: user.id });

    // 감사 로그
    await AuditLog.create({
      user_id: adminId,
      action: 'ADMIN_CREATE_USER',
      resource_type: 'user',
      resource_id: user.id,
      details: { username, email, role },
    });

    res.status(201).json({
      success: true,
      message: '사용자가 생성되었습니다.',
      data: { user: user.toPublicJSON() },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 사용자 수정 (관리자)
 * PUT /api/v1/users/:id
 */
const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { username, email, role, is_active } = req.body;
    const adminId = req.user.id;

    const user = await User.findByPk(id);

    if (!user) {
      throw ApiError.notFound('사용자를 찾을 수 없습니다.');
    }

    // 자기 자신의 role은 변경 불가
    if (parseInt(id) === adminId && role && role !== user.role) {
      throw ApiError.badRequest('자신의 권한은 변경할 수 없습니다.');
    }

    // 이메일/사용자명 중복 확인
    if (email && email !== user.email) {
      const existing = await User.findOne({
        where: { email, id: { [Op.ne]: id } },
      });
      if (existing) {
        throw ApiError.conflict('이미 사용 중인 이메일입니다.');
      }
    }

    if (username && username !== user.username) {
      const existing = await User.findOne({
        where: { username, id: { [Op.ne]: id } },
      });
      if (existing) {
        throw ApiError.conflict('이미 사용 중인 사용자명입니다.');
      }
    }

    const updateData = {};
    if (username) updateData.username = username;
    if (email) updateData.email = email;
    if (role) updateData.role = role;
    if (is_active !== undefined) updateData.is_active = is_active;

    await user.update(updateData);

    logger.info(`User updated by admin: ${user.username}`, { adminId, userId: id });

    // 감사 로그
    await AuditLog.create({
      user_id: adminId,
      action: 'ADMIN_UPDATE_USER',
      resource_type: 'user',
      resource_id: parseInt(id),
      details: updateData,
    });

    res.json({
      success: true,
      message: '사용자 정보가 수정되었습니다.',
      data: { user: user.toPublicJSON() },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 사용자 삭제 (관리자)
 * DELETE /api/v1/users/:id
 */
const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const adminId = req.user.id;

    // 자기 자신 삭제 불가
    if (parseInt(id) === adminId) {
      throw ApiError.badRequest('자신의 계정은 삭제할 수 없습니다.');
    }

    const user = await User.findByPk(id);

    if (!user) {
      throw ApiError.notFound('사용자를 찾을 수 없습니다.');
    }

    const username = user.username;
    await user.destroy();

    logger.info(`User deleted by admin: ${username}`, { adminId, userId: id });

    // 감사 로그
    await AuditLog.create({
      user_id: adminId,
      action: 'ADMIN_DELETE_USER',
      resource_type: 'user',
      resource_id: parseInt(id),
      details: { username },
    });

    res.json({
      success: true,
      message: '사용자가 삭제되었습니다.',
      data: { id: parseInt(id) },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 사용자 활성화/비활성화 토글 (관리자)
 * PATCH /api/v1/users/:id/toggle
 */
const toggleUserStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const adminId = req.user.id;

    // 자기 자신 비활성화 불가
    if (parseInt(id) === adminId) {
      throw ApiError.badRequest('자신의 계정은 비활성화할 수 없습니다.');
    }

    const user = await User.findByPk(id);

    if (!user) {
      throw ApiError.notFound('사용자를 찾을 수 없습니다.');
    }

    const newStatus = !user.is_active;
    await user.update({ is_active: newStatus });

    logger.info(`User ${newStatus ? 'activated' : 'deactivated'}: ${user.username}`, { adminId, userId: id });

    res.json({
      success: true,
      message: `사용자가 ${newStatus ? '활성화' : '비활성화'}되었습니다.`,
      data: {
        id: parseInt(id),
        is_active: newStatus,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 사용자 비밀번호 초기화 (관리자)
 * POST /api/v1/users/:id/reset-password
 */
const resetUserPassword = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;
    const adminId = req.user.id;

    const user = await User.findByPk(id);

    if (!user) {
      throw ApiError.notFound('사용자를 찾을 수 없습니다.');
    }

    await user.update({ password_hash: newPassword });

    logger.info(`User password reset by admin: ${user.username}`, { adminId, userId: id });

    // 감사 로그
    await AuditLog.create({
      user_id: adminId,
      action: 'ADMIN_RESET_PASSWORD',
      resource_type: 'user',
      resource_id: parseInt(id),
      ip_address: req.ip,
    });

    res.json({
      success: true,
      message: '비밀번호가 초기화되었습니다.',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  // 인증
  register,
  login,
  logout,
  // 프로필
  getProfile,
  updateProfile,
  changePassword,
  // 관리자
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  toggleUserStatus,
  resetUserPassword,
};
