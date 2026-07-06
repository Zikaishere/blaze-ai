const mongoose = require("mongoose");

const systemPromptSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, default: "additions" },
  additions: [String],
});

module.exports = mongoose.model("SystemPrompt", systemPromptSchema);
