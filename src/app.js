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

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const API_PREFIX = '/api/v1';

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

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

if (NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', {
    stream: {
      write: (message) => logger.http(message.trim()),
    },
  }));
}

app.set('trust proxy', 1);

try {
  const swaggerDocument = YAML.load(path.join(__dirname, 'swagger.yaml'));
  
  const swaggerOptions = {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'NetScopeNMS API Documentation',
    customfavIcon: '/favicon.ico',
  };

  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, swaggerOptions));
  
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerDocument);
  });

  logger.info('Swagger documentation loaded successfully');
} catch (error) {
  logger.warn('Swagger documentation not loaded:', error.message);
}

app.use(API_PREFIX, routes);

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

app.use(notFoundHandler);

app.use(errorHandler);

const startServer = async () => {
  try {
    await sequelize.authenticate();
    logger.info('✅ Database connection established successfully');

    if (NODE_ENV === 'development') {
      await sequelize.sync({ alter: false });
      logger.info('✅ Database models synchronized');
    }

    if (process.env.ENABLE_SCHEDULER === 'true') {
      schedulerService.startAll();
      logger.info('✅ Scheduler services started');
    }

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

    const gracefulShutdown = async (signal) => {
      logger.info(`${signal} received. Starting graceful shutdown...`);
      
      server.close(async () => {
        logger.info('HTTP server closed');
        
        if (process.env.ENABLE_SCHEDULER === 'true') {
          schedulerService.stopAll();
          logger.info('Scheduler services stopped');
        }
        
        await sequelize.close();
        logger.info('Database connection closed');
        
        process.exit(0);
      });

      setTimeout(() => {
        logger.error('Forced shutdown due to timeout');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

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

startServer();

module.exports = app;
