// models/EmailSchedule.js
const mongoose = require("mongoose");

const EmailScheduleSchema = new mongoose.Schema({
  sslId: {
    type: Number,
    required: true,
    ref: "SSLDetails",
    unique: true
  },
  nextEmailDates: {
     Normal: { type: Date },
    thirtyDays: { type: Date },
    fifteenDays: { type: Date },
    tenDays: { type: Date },
    fiveDays: { type: Date },
    daily: { type: Date }
  },
  emailsSent: {
    Normal: { type: Boolean, default: false },
    thirtyDays: { type: Boolean, default: false },
    fifteenDays: { type: Boolean, default: false },
    tenDays: { type: Boolean, default: false },
    fiveDays: { type: Boolean, default: false },
    dailySentCount: { type: Number, default: 0 }
  },
  notificationsEnabled: {
    type: Boolean,
    default: true
  },
  ssl: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "SSLDetails"
  }
}, { timestamps: true });

// Index for efficient querying
EmailScheduleSchema.index({ 
  "nextEmailDates.thirtyDays": 1, 
  "nextEmailDates.fifteenDays": 1,
  "nextEmailDates.tenDays": 1,
  "nextEmailDates.fiveDays": 1,
  "nextEmailDates.daily": 1
});

const EmailSchedule = mongoose.model("EmailSchedule", EmailScheduleSchema);
module.exports = EmailSchedule;