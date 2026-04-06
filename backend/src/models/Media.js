const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const Media = sequelize.define('Media', {
  filename: { type: DataTypes.STRING, allowNull: false },
  original_name: { type: DataTypes.STRING, allowNull: false },
  url: { type: DataTypes.STRING, allowNull: false },
  mime_type: { type: DataTypes.STRING },
  size: { type: DataTypes.INTEGER },
});

module.exports = Media;
