/**
 * User Model
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const bcrypt = require('bcrypt');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    primaryKey: true,
    autoIncrement: true,
  },
  username: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    validate: {
      len: [3, 50],
    },
  },
  email: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true,
    },
  },
  password_hash: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  role: {
    type: DataTypes.ENUM('admin', 'user', 'viewer'),
    allowNull: false,
    defaultValue: 'viewer',
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  last_login: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'users',
  timestamps: true,
  hooks: {
    beforeCreate: async (user) => {
      if (user.password_hash) {
        user.password_hash = await bcrypt.hash(user.password_hash, 10);
      }
    },
    beforeUpdate: async (user) => {
      if (user.changed('password_hash')) {
        user.password_hash = await bcrypt.hash(user.password_hash, 10);
      }
    },
  },
});

/**
 * Instance Methods
 */

// Verify password
User.prototype.verifyPassword = async function(password) {
  return bcrypt.compare(password, this.password_hash);
};

// Get public profile (exclude sensitive data)
User.prototype.toPublicJSON = function() {
  return {
    id: this.id,
    username: this.username,
    email: this.email,
    role: this.role,
    isActive: this.is_active,
    lastLogin: this.last_login,
    createdAt: this.created_at,
  };
};

/**
 * Class Methods
 */

// Find by credentials
User.findByCredentials = async function(email, password) {
  const user = await this.findOne({ where: { email, is_active: true } });
  if (!user) return null;
  
  const isValid = await user.verifyPassword(password);
  return isValid ? user : null;
};

module.exports = User;
