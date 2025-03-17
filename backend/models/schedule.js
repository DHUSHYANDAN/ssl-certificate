const { Sequelize, DataTypes, Model } = require("sequelize");
const sequelize = require("../db");

class Schedule extends Model {}
Schedule.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    cronSchedule: {
      type: DataTypes.STRING,
      defaultValue: "0 6 * * *",
    },
    active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    sequelize,
    modelName: "Schedule",
  }
);


module.exports = Schedule;
