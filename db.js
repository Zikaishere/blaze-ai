const mongoose = require("mongoose");

async function migrateLegacyChatHistories() {
  const legacyDocs = await ChatHistory.find({
    $or: [{ chatKey: { $exists: false } }, { chatKey: null }],
  }).lean();

  if (!legacyDocs.length) return;

  for (const doc of legacyDocs) {
    const fallbackUserId = doc.userId || String(doc._id);
    const fallbackChannelId = doc.channelId || "legacy-channel";
    const chatKey = `${fallbackChannelId}:${fallbackUserId}`;

    await ChatHistory.updateOne(
      { _id: doc._id },
      {
        $set: {
          chatKey,
          userId: doc.userId || fallbackUserId,
          channelId: doc.channelId || fallbackChannelId,
          guildId: doc.guildId || null,
        },
      },
    );
  }

  console.log(`Migrated ${legacyDocs.length} legacy chat history document(s).`);
}

const connectDB = async () => {
  if (!process.env.MONGO_URI) {
    console.error("Missing MONGO_URI in .env file!");
    return;
  }
  try {
    await mongoose.connect(process.env.MONGO_URI);
    await migrateLegacyChatHistories();
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
