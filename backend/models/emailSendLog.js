const { Sequelize, DataTypes, Model } = require("sequelize");
const sequelize = require("../db");
const SSLDetails = require("./URLdb");

class EmailSendLog extends Model {}
EmailSendLog.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    sslId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: SSLDetails,
        key: "sslId",
      },
    },
    emailType: {
      type: DataTypes.ENUM("Normal", "30days", "15days", "10days", "5days", "daily"),
      allowNull: false,
    },
    recipient: {
      type: DataTypes.STRING,
      allowNull: false
    },
    subject: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    sentAt: {
      type: DataTypes.DATE,
      defaultValue: Sequelize.NOW,
    },
    status: {
      type: DataTypes.ENUM("success", "failed", "pending"),
      defaultValue: "pending",
    },
    statusMessage: {
      type: DataTypes.STRING,
    },
  },
  {
    sequelize,
    modelName: "EmailSendLog",
  }
);

module.exports = EmailSendLog;
