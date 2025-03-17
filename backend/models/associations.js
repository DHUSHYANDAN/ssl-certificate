const SSLDetails = require("./URLdb");
const EmailSchedule = require("./emailschedule");
const EmailSendLog = require("./emailSendLog");

// SSLDetails & EmailSchedule (One-to-One)
SSLDetails.hasOne(EmailSchedule, { foreignKey: "sslId", as: "emailSchedule", onDelete: "CASCADE" });
EmailSchedule.belongsTo(SSLDetails, { foreignKey: "sslId", as: "sslDetail" });

// SSLDetails & EmailSendLog (One-to-Many)
SSLDetails.hasMany(EmailSendLog, { foreignKey: "sslId", onDelete: "CASCADE" });
EmailSendLog.belongsTo(SSLDetails, { foreignKey: "sslId" });

module.exports = { SSLDetails, EmailSchedule, EmailSendLog };
