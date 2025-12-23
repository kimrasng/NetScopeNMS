const { Sequelize } = require('sequelize');
const logger = require('../utils/logger');

// Environment variables
const config = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  database: process.env.DB_NAME || 'netscopenms',
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  pool: {
    max: parseInt(process.env.DB_POOL_MAX, 10) || 10,
    min: parseInt(process.env.DB_POOL_MIN, 10) || 0,
    idle: parseInt(process.env.DB_POOL_IDLE, 10) || 10000,
    acquire: 30000,
  },
};

// Sequelize instance
const sequelize = new Sequelize(config.database, config.username, config.password, {
  host: config.host,
  port: config.port,
  dialect: 'mysql',
  pool: config.pool,
  logging: process.env.NODE_ENV === 'development' ? (msg) => logger.debug(msg) : false,
  timezone: '+09:00', // Korea timezone
  define: {
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
  dialectOptions: {
    dateStrings: true,
    typeCast: true,
  },
});

const testConnection = async () => {
  try {
    await sequelize.authenticate();
    logger.info('Database connection established successfully');
    return true;
  } catch (error) {
    logger.error('Unable to connect to database:', error);
    return false;
  }
};

const syncDatabase = async (force = false) => {
  try {
    await sequelize.sync({ force });
    logger.info(`Database synced${force ? ' (forced)' : ''}`);
  } catch (error) {
    logger.error('Database sync error:', error);
    throw error;
  }
};

const closeConnection = async () => {
  try {
    await sequelize.close();
    logger.info('Database connection closed');
  } catch (error) {
    logger.error('Error closing database connection:', error);
  }
};

module.exports = {
  sequelize,
  Sequelize,
  testConnection,
  syncDatabase,
  closeConnection,
  config,
};
