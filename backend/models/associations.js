const SSLDetails = require("./URLdb");
const EmailSchedule = require("./emailschedule");
const EmailSendLog = require("./emailSendLog");

// One-to-One: SSLDetails → EmailSchedule
SSLDetails.hasOne(EmailSchedule, {
  foreignKey: "sslId",
  as: "emailSchedule",
  onDelete: "CASCADE",
});
EmailSchedule.belongsTo(SSLDetails, {
  foreignKey: "sslId",
  as: "sslDetail",
});

// One-to-Many: SSLDetails → EmailSendLog
SSLDetails.hasMany(EmailSendLog, {
  foreignKey: "sslId",
  onDelete: "CASCADE",
});
EmailSendLog.belongsTo(SSLDetails, {
  foreignKey: "sslId",
});

module.exports = { SSLDetails, EmailSchedule, EmailSendLog };
