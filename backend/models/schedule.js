
const mongoose = require("mongoose");




const TimeSchedule = new mongoose.Schema({
    name: { type: String },
  cronSchedule: { type: String, default: "0 6 * * *"  },
});

const Schedule = mongoose.model("Schedule", TimeSchedule);

module.exports = Schedule;