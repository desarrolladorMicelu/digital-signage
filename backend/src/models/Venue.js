const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const Venue = sequelize.define('Venue', {
  name: { type: DataTypes.STRING, allowNull: false },
  address: { type: DataTypes.STRING, defaultValue: '' },
  description: { type: DataTypes.TEXT, defaultValue: '' },
});

module.exports = Venue;
