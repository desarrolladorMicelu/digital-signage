const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const Screen = sequelize.define('Screen', {
  name: { type: DataTypes.STRING, allowNull: false },
  device_id: { type: DataTypes.STRING, unique: true, allowNull: false },
  orientation: { type: DataTypes.STRING, defaultValue: 'landscape' },
  status: { type: DataTypes.STRING, defaultValue: 'offline' },
  last_heartbeat: { type: DataTypes.DATE },
});

module.exports = Screen;
