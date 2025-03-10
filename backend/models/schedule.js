// models/Schedule.js
const mongoose = require("mongoose");

const TimeScheduleSchema = new mongoose.Schema({

  cronSchedule: { 
    type: String, 
    default: "0 6 * * *" 
  },

  active: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

const Schedule = mongoose.model("Schedule", TimeScheduleSchema);
module.exports = Schedule;