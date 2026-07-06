const mongoose = require("mongoose");

const userMemorySchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  profile: { type: String, default: "" },
  facts: [String],
  messageCount: { type: Number, default: 0 },

  moderation: {
    banned: { type: Boolean, default: false },
    reason: { type: String, default: null },
    bannedAt: { type: Date, default: null },
    bannedBy: { type: String, default: null },
    infractions: [
      {
        type: { type: String, enum: ["warn", "kick", "ban"], required: true },
        reason: { type: String, default: null },
        moderatorId: { type: String, default: null },
        timestamp: { type: Date, default: Date.now },
        guildId: { type: String, default: null },
        channelId: { type: String, default: null },
      },
    ],
  },
});

module.exports = mongoose.model("UserMemory", userMemorySchema);
