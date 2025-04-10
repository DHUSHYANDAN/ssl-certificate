const { Sequelize, DataTypes, Model } = require("sequelize");
const sequelize = require("../db");

class SSLDetails extends Model {}

SSLDetails.init(
  {
    sslId: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    url: { type: DataTypes.STRING, allowNull: false, unique: true },
    issuedToCommonName: { type: DataTypes.STRING, allowNull: false },
    issuedToOrganization: { type: DataTypes.STRING, allowNull: false },
    issuedByCommonName: { type: DataTypes.STRING, allowNull: false },
    issuedByOrganization: { type: DataTypes.STRING, allowNull: false },
    validFrom: { type: DataTypes.DATE, allowNull: false },
    validTo: { type: DataTypes.DATE, allowNull: false },
    siteManager: { type: DataTypes.STRING },
    email: { type: DataTypes.STRING },
    image_url: { type: DataTypes.STRING },
    
  
  },
  { sequelize, modelName: "SSLDetails", tableName: "ssl_details", timestamps: true, }
);

module.exports = SSLDetails;
