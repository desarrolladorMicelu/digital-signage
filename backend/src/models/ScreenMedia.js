const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const ScreenMedia = sequelize.define('ScreenMedia', {
  screen_id: { type: DataTypes.INTEGER, allowNull: false },
  media_id:  { type: DataTypes.INTEGER, allowNull: false },
  duration:  { type: DataTypes.INTEGER, defaultValue: 10 },
  position:  { type: DataTypes.INTEGER, defaultValue: 0 },
});

module.exports = ScreenMedia;
