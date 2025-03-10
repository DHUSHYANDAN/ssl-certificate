// models/EmailSendLog.js
const mongoose = require("mongoose");

const EmailSendLogSchema = new mongoose.Schema({
  sslId: {
    type: Number,
    required: true,
    ref: "SSLDetails"
  },
  emailType: {
    type: String,
    required: true,
    enum: ["30days", "15days", "10days", "5days", "daily"]
  },
  recipient: {
    type: String,
    required: true
  },
  subject: {
    type: String,
    required: true
  },
  sentAt: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ["success", "failed", "pending"],
    required: true,
    default: "pending"
  },
  statusMessage: {
    type: String
  },
  sslDetails: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "SSLDetails"
  }
}, { timestamps: true });

// Index for efficient querying
EmailSendLogSchema.index({ sslId: 1, emailType: 1 });
EmailSendLogSchema.index({ sentAt: 1 });

const EmailSendLog = mongoose.model("EmailSendLog", EmailSendLogSchema);
module.exports = EmailSendLog;