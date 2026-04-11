const mongoose = require("mongoose");

const connectDB = async () => {
  if (!process.env.MONGO_URI) {
    console.error("Missing MONGO_URI in .env file!");
    return;
  }
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB Connected successfully!");
  } catch (error) {
    console.error("MongoDB Connection Error:", error);
  }
};

const chatHistorySchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
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
});

const ChatHistory = mongoose.model("ChatHistory", chatHistorySchema);
const UserMemory = mongoose.model("UserMemory", userMemorySchema);

module.exports = { connectDB, ChatHistory, UserMemory };
