/**
 * NetScopeNMS Backend Application
 * AI 기반 네트워크 관리 시스템
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');

const logger = require('./utils/logger');
const { sequelize } = require('./models');
const routes = require('./routes');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const schedulerService = require('./services/schedulerService');

const app = express();

// ==================== 환경 변수 ====================
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const API_PREFIX = '/api/v1';

// ==================== 보안 미들웨어 ====================

// Helmet - 보안 헤더 설정
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// CORS 설정
const corsOptions = {
  origin: process.env.CORS_ORIGIN 
    ? process.env.CORS_ORIGIN.split(',') 
    : ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:8080'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  maxAge: 86400, // 24 hours
};
app.use(cors(corsOptions));

// Rate Limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15분
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 1000, // 최대 요청 수
  message: {
    success: false,
    error: 'Too many requests',
    message: '너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(API_PREFIX, limiter);

// 인증 엔드포인트 추가 제한
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  max: 10, // 로그인 시도 제한
  message: {
    success: false,
    error: 'Too many login attempts',
    message: '로그인 시도가 너무 많습니다. 15분 후 다시 시도해주세요.',
  },
});
app.use(`${API_PREFIX}/users/login`, authLimiter);
app.use(`${API_PREFIX}/users/register`, authLimiter);

// ==================== 기본 미들웨어 ====================

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
if (NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  // Production: 커스텀 포맷으로 Winston 로거 사용
  app.use(morgan('combined', {
    stream: {
      write: (message) => logger.http(message.trim()),
    },
  }));
}

// Trust proxy (nginx, load balancer 뒤에서 실행 시)
app.set('trust proxy', 1);

// ==================== Swagger API 문서 ====================

try {
  const swaggerDocument = YAML.load(path.join(__dirname, 'swagger.yaml'));
  
  const swaggerOptions = {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'NetScopeNMS API Documentation',
    customfavIcon: '/favicon.ico',
  };

  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, swaggerOptions));
  
  // Swagger JSON endpoint
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerDocument);
  });

  logger.info('Swagger documentation loaded successfully');
} catch (error) {
  logger.warn('Swagger documentation not loaded:', error.message);
}

// ==================== API 라우트 ====================

// API Routes
app.use(API_PREFIX, routes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'NetScopeNMS Backend Server',
    version: '1.0.0',
    environment: NODE_ENV,
    api: `${API_PREFIX}`,
    documentation: '/api-docs',
    health: `${API_PREFIX}/health`,
  });
});

// ==================== 에러 핸들링 ====================

// 404 Not Found
app.use(notFoundHandler);

// Global Error Handler
app.use(errorHandler);

// ==================== 서버 시작 ====================

const startServer = async () => {
  try {
    // 데이터베이스 연결
    await sequelize.authenticate();
    logger.info('✅ Database connection established successfully');

    // 테이블 동기화 (개발 환경에서만 alter 사용)
    if (NODE_ENV === 'development') {
      await sequelize.sync({ alter: false }); // alter: true 는 주의해서 사용
      logger.info('✅ Database models synchronized');
    }

    // 스케줄러 시작 (프로덕션 또는 스케줄러 활성화 시)
    if (process.env.ENABLE_SCHEDULER === 'true') {
      schedulerService.startAll();
      logger.info('✅ Scheduler services started');
    }

    // 서버 시작
    const server = app.listen(PORT, () => {
      logger.info(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   🌐 NetScopeNMS Backend Server                       ║
║                                                       ║
║   Environment: ${NODE_ENV.padEnd(20)}                ║
║   Port: ${PORT.toString().padEnd(26)}                ║
║   API: http://localhost:${PORT}${API_PREFIX.padEnd(16)}  ║
║   Docs: http://localhost:${PORT}/api-docs${' '.repeat(13)}║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
      `);
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal) => {
      logger.info(`${signal} received. Starting graceful shutdown...`);
      
      server.close(async () => {
        logger.info('HTTP server closed');
        
        // 스케줄러 중지
        if (process.env.ENABLE_SCHEDULER === 'true') {
          schedulerService.stopAll();
          logger.info('Scheduler services stopped');
        }
        
        // 데이터베이스 연결 종료
        await sequelize.close();
        logger.info('Database connection closed');
        
        process.exit(0);
      });

      // 강제 종료 타임아웃 (30초)
      setTimeout(() => {
        logger.error('Forced shutdown due to timeout');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Uncaught exception handler
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });

  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// 서버 시작
startServer();

module.exports = app;
