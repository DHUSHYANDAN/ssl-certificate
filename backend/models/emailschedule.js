const { Sequelize, DataTypes, Model } = require("sequelize");
const sequelize = require("../db");
const SSLDetails = require("./URLdb");

class EmailSchedule extends Model {}

EmailSchedule.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    sslId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      references: { model: SSLDetails, key: "sslId" },
    },
    nextEmailDates: { type: DataTypes.JSON },
    emailsSent: { type: DataTypes.JSON },
    notificationsEnabled: { type: DataTypes.BOOLEAN, defaultValue: true },
  },
  { sequelize, modelName: "EmailSchedule", tableName: "email_schedules", timestamps: true }
);

module.exports = EmailSchedule;
