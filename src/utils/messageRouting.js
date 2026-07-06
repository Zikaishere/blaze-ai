function stripBotMention(content, botUserId) {
  return content
    .replaceAll(`<@${botUserId}>`, "")
    .replaceAll(`<@!${botUserId}>`, "")
    .trim();
}

function isBotConversationMessage(message, clientUserId) {
  const isDirectMessage =
    message.channel?.isDMBased?.() ||
    (typeof message.inGuild === "function"
      ? !message.inGuild()
      : !message.guildId && !message.guild);
  const mentioned = new RegExp(`<@!?${clientUserId}>`).test(message.content || "");
  const isReplyToBot = message.mentions.repliedUser?.id === clientUserId;

  return {
    isDirectMessage,
    isReplyToBot,
    mentioned,
    shouldHandle: isDirectMessage || mentioned || isReplyToBot,
  };
}

module.exports = {
  isBotConversationMessage,
  stripBotMention,
};
