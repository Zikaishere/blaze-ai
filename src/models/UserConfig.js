const mongoose = require("mongoose");

const userConfigSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  style: {
    type: String,
    enum: ["default", "short", "long", "casual", "formal"],
    default: "default",
  },
  memoryEnabled: { type: Boolean, default: true },
  customFacts: { type: [String], default: [] },
});

module.exports = mongoose.model("UserConfig", userConfigSchema);
