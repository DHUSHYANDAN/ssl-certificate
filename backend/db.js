require('dotenv').config(); // Load environment variables from .env

const { Sequelize } = require("sequelize");

const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
  host: process.env.DB_HOST,
  dialect: "postgres",
  logging: false, // optional: disable SQL query logging
});

module.exports = sequelize;
