const mongoose = require("mongoose");

const errorLogSchema = new mongoose.Schema({
  errId: { type: String, required: true, unique: true },
  message: { type: String, default: "" },
  stack: { type: String, default: "No stack trace" },
  time: { type: Date, default: Date.now },
});

errorLogSchema.index({ time: 1 }, { expireAfterSeconds: 604800 });

module.exports = mongoose.model("ErrorLog", errorLogSchema);
