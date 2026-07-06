const mongoose = require("mongoose");

const chatHistorySchema = new mongoose.Schema({
  chatKey: { type: String, required: true, unique: true },
  userId: { type: String, required: false },
  channelId: { type: String, required: false },
  guildId: { type: String, default: null },
  messages: [
    {
      role: String,
      content: String,
    },
  ],
});

module.exports = mongoose.model("ChatHistory", chatHistorySchema);
