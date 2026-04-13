const { ChatHistory } = require("../../db");
const { MAX_HISTORY } = require("../config");

async function getChatHistory(chatKey) {
  let doc = await ChatHistory.findOne({ chatKey });

  if (!doc) {
    doc = new ChatHistory({ chatKey, messages: [] });
    await doc.save();
  }

  return doc.messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));
}

async function addToChatHistory(chatContext, role, content) {
  let doc = await ChatHistory.findOne({ chatKey: chatContext.chatKey });

  if (!doc) {
    doc = new ChatHistory({
      chatKey: chatContext.chatKey,
      userId: chatContext.userId,
      channelId: chatContext.channelId,
      guildId: chatContext.guildId,
      messages: [],
    });
  }

  doc.userId = chatContext.userId;
  doc.channelId = chatContext.channelId;
  doc.guildId = chatContext.guildId;
  doc.messages.push({ role, content });

  if (doc.messages.length > MAX_HISTORY) {
    doc.messages = doc.messages.slice(doc.messages.length - MAX_HISTORY);
  }

  await doc.save();
}

module.exports = {
  addToChatHistory,
  getChatHistory,
};
