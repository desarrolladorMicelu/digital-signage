const { Sequelize } = require('sequelize');
const path = require('path');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.resolve(__dirname, '..', process.env.DB_PATH || './database.sqlite'),
  logging: false,
});

module.exports = sequelize;
