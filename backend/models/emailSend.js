const mongoose = require("mongoose");

const EmailLogSchema = new mongoose.Schema({
  sslId: { type: Number, required: true }, 
  url: { type: String, required: true },
  siteManager: { type: String, required: true },
  email: { type: String, required: true },
  daysLeft: { type: Number, required: true }, 
  sentAt: { type: Date, default: Date.now },
  sentBy: { type: String, required: true }, 
  status: { type: String, enum: ["Sent", "Failed"], default: "Sent" }, 
});

module.exports = mongoose.model("EmailLog", EmailLogSchema);
