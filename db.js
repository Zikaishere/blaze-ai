const mongoose = require("mongoose");

const connectDB = async () => {
  if (!process.env.MONGO_URI) {
    console.error("Missing MONGO_URI in .env file!");
    return;
  }
  try {
    await mongoose.connect(process.env.MONGO_URI);
    await Promise.all([
      ChatHistory.syncIndexes(),
      UserMemory.syncIndexes(),
      ConversationState.syncIndexes(),
    ]);
    console.log("MongoDB Connected successfully!");
  } catch (error) {
    console.error("MongoDB Connection Error:", error);
  }
};

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

const userMemorySchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  facts: [String],

  moderation: {
    banned: { type: Boolean, default: false },
    reason: { type: String, default: null },
    bannedAt: { type: Date, default: null },
    bannedBy: { type: String, default: null },
  }
});

const conversationStateSchema = new mongoose.Schema({
  chatKey: { type: String, required: true, unique: true },
  userId: { type: String, required: true },
  channelId: { type: String, required: true },
  guildId: { type: String, default: null },
  devMode: { type: Boolean, default: false },
});

const ChatHistory = mongoose.model("ChatHistory", chatHistorySchema);
const UserMemory = mongoose.model("UserMemory", userMemorySchema);
const ConversationState = mongoose.model("ConversationState", conversationStateSchema);

module.exports = { connectDB, ChatHistory, ConversationState, UserMemory };
