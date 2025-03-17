const { Sequelize, DataTypes, Model } = require("sequelize");
const sequelize = require("../db");

class SSLDetails extends Model {}

SSLDetails.init(
  {
    sslId: {
      type: DataTypes.INTEGER,
      primaryKey: true, // Ensure it's the primary key
      autoIncrement: true, // Auto-generate IDs
    },
    url: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
   
    issuedToCommonName: { type: DataTypes.STRING, allowNull: false },
    issuedToOrganization: { type: DataTypes.STRING, allowNull: false },
    issuedByCommonName: { type: DataTypes.STRING, allowNull: false },
    issuedByOrganization: { type: DataTypes.STRING, allowNull: false },
    validFrom: { type: DataTypes.DATE, allowNull: false },
    validTo: { type: DataTypes.DATE, allowNull: false },
    siteManager: { type: DataTypes.STRING,},

    email: {
      type: DataTypes.STRING,
     
      
    },
  },
  {
    sequelize,
    modelName: "SSLDetails",
  }
);

module.exports = SSLDetails;
