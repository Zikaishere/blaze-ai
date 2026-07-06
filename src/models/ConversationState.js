const mongoose = require("mongoose");

const conversationStateSchema = new mongoose.Schema({
  chatKey: { type: String, required: true, unique: true },
  userId: { type: String, required: true },
  channelId: { type: String, required: true },
  guildId: { type: String, default: null },
});

module.exports = mongoose.model("ConversationState", conversationStateSchema);
