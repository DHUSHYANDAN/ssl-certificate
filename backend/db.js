const { Sequelize } = require("sequelize");
require("dotenv").config();

const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: "../ssl-certificate.db", 
  logging: process.env.NODE_ENV === "development" ? console.log : false, // Enable logging in development
});

module.exports = sequelize;
