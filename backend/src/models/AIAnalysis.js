/**
 * AI Analysis Model
 */

const { DataTypes, Op } = require('sequelize');
const { sequelize } = require('../config/database');

const ANALYSIS_TYPES = ['alarm_rca', 'prediction', 'daily_report', 'weekly_report', 'anomaly_detection'];

const AIAnalysis = sequelize.define('AIAnalysis', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    primaryKey: true,
    autoIncrement: true,
  },
  device_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    comment: 'NULL for global reports',
  },
  alarm_id: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: true,
  },
  analysis_type: {
    type: DataTypes.ENUM(...ANALYSIS_TYPES),
    allowNull: false,
  },
  prompt_summary: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: 'summary of what was sent to AI',
  },
  result: {
    type: DataTypes.JSON,
    allowNull: false,
  },
  model_used: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  tokens_used: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
  },
  response_time_ms: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
  },
  cache_key: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  expires_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'ai_analyses',
  timestamps: true,
  updatedAt: false, // Only createdAt
  indexes: [
    { fields: ['device_id'] },
    { fields: ['analysis_type'] },
    { fields: ['created_at'] },
    { fields: ['cache_key', 'expires_at'] },
  ],
});

/**
 * Instance Methods
 */

// Check if result is still valid (not expired)
AIAnalysis.prototype.isValid = function() {
  if (!this.expires_at) return true;
  return new Date() < new Date(this.expires_at);
};

// Get public JSON
AIAnalysis.prototype.toPublicJSON = function() {
  return {
    id: this.id,
    deviceId: this.device_id,
    alarmId: this.alarm_id,
    analysisType: this.analysis_type,
    promptSummary: this.prompt_summary,
    result: this.result,
    modelUsed: this.model_used,
    tokensUsed: this.tokens_used,
    responseTimeMs: this.response_time_ms,
    createdAt: this.created_at,
    isValid: this.isValid(),
  };
};

/**
 * Class Methods
 */

// Find cached analysis
AIAnalysis.findCached = async function(cacheKey) {
  if (!cacheKey) return null;
  
  return this.findOne({
    where: {
      cache_key: cacheKey,
      expires_at: {
        [Op.gt]: new Date(),
      },
    },
    order: [['created_at', 'DESC']],
  });
};

// Get recent analyses for device
AIAnalysis.getForDevice = async function(deviceId, type = null, limit = 10) {
  const where = { device_id: deviceId };
  if (type) {
    where.analysis_type = type;
  }
  
  return this.findAll({
    where,
    order: [['created_at', 'DESC']],
    limit,
  });
};

// Get latest report
AIAnalysis.getLatestReport = async function(type) {
  return this.findOne({
    where: {
      analysis_type: type,
      device_id: null, // Global reports
    },
    order: [['created_at', 'DESC']],
  });
};

// Get analyses by type within time range
AIAnalysis.getByTypeAndTime = async function(type, startTime, endTime) {
  return this.findAll({
    where: {
      analysis_type: type,
      created_at: {
        [Op.between]: [startTime, endTime],
      },
    },
    order: [['created_at', 'DESC']],
  });
};

// Create with caching
AIAnalysis.createWithCache = async function(data, cacheHours = 1) {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + cacheHours);
  
  return this.create({
    ...data,
    expires_at: expiresAt,
  });
};

// Clean up expired cache entries
AIAnalysis.cleanupExpired = async function() {
  return this.destroy({
    where: {
      expires_at: {
        [Op.lt]: new Date(),
        [Op.ne]: null,
      },
    },
  });
};

// Get usage statistics
AIAnalysis.getUsageStats = async function(days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return sequelize.query(`
    SELECT 
      DATE(created_at) as date,
      analysis_type,
      COUNT(*) as count,
      SUM(tokens_used) as total_tokens,
      AVG(response_time_ms) as avg_response_time
    FROM ai_analyses
    WHERE created_at >= :startDate
    GROUP BY DATE(created_at), analysis_type
    ORDER BY date DESC
  `, {
    replacements: { startDate },
    type: sequelize.QueryTypes.SELECT,
  });
};

// Constants
AIAnalysis.ANALYSIS_TYPES = ANALYSIS_TYPES;

module.exports = AIAnalysis;
