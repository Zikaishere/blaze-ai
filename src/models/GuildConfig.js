const mongoose = require("mongoose");

const guildConfigSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  prefix: { type: String, default: null },
  model: { type: String, default: null },
  maxTokens: { type: Number, default: null },
  temperature: { type: Number, default: null },
  cooldownMs: { type: Number, default: null },
  aiEnabled: { type: Boolean, default: true },
  allowedChannels: { type: [String], default: [] },
  promptAdditions: { type: [String], default: [] },
});

module.exports = mongoose.model("GuildConfig", guildConfigSchema);
