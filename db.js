const mongoose = require("mongoose");
const ChatHistory = require("./src/models/ChatHistory");
const UserMemory = require("./src/models/UserMemory");
const ConversationState = require("./src/models/ConversationState");
const ErrorLog = require("./src/models/ErrorLog");
const SystemPrompt = require("./src/models/SystemPrompt");
const GuildConfig = require("./src/models/GuildConfig");
const UserConfig = require("./src/models/UserConfig");

async function connectDB(retries = 3) {
  if (!process.env.MONGO_URI) {
    console.error("Missing MONGO_URI in .env file!");
    return;
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await mongoose.connect(process.env.MONGO_URI);
      await Promise.all([
        ChatHistory.syncIndexes(),
        UserMemory.syncIndexes(),
        ConversationState.syncIndexes(),
        ErrorLog.syncIndexes(),
        SystemPrompt.syncIndexes(),
        GuildConfig.syncIndexes(),
        UserConfig.syncIndexes(),
      ]);
      console.log("MongoDB Connected successfully!");
      return;
    } catch (error) {
      console.error(`MongoDB Connection Error (attempt ${attempt}/${retries}):`, error.message);
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 2000 * attempt));
      } else {
        console.error("All MongoDB connection attempts failed.");
      }
    }
  }
}

module.exports = { connectDB, ChatHistory, ConversationState, UserMemory, ErrorLog, SystemPrompt, GuildConfig, UserConfig };
