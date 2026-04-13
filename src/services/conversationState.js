const { ConversationState } = require("../../db");

async function getConversationState(chatContext) {
  let doc = await ConversationState.findOne({ chatKey: chatContext.chatKey });

  if (!doc) {
    doc = new ConversationState({
      chatKey: chatContext.chatKey,
      userId: chatContext.userId,
      channelId: chatContext.channelId,
      guildId: chatContext.guildId,
      devMode: false,
    });
    await doc.save();
  }

  return doc;
}

async function setDevMode(chatContext, enabled) {
  const state = await getConversationState(chatContext);

  state.userId = chatContext.userId;
  state.channelId = chatContext.channelId;
  state.guildId = chatContext.guildId;
  state.devMode = enabled;

  await state.save();
  return state;
}

module.exports = {
  getConversationState,
  setDevMode,
};
