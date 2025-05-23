const { Sequelize, DataTypes, Model } = require("sequelize");
const sequelize = require("../db");

class User extends Model {}
User.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: false, unique: true, validate: { isEmail: true } },
    password: { type: DataTypes.STRING, allowNull: false },
  },
  { sequelize, modelName: "User", tableName: "users", timestamps: true }
);

module.exports = User;
