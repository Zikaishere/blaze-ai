function stripBotMention(content, botUserId) {
  return content
    .replaceAll(`<@${botUserId}>`, "")
    .replaceAll(`<@!${botUserId}>`, "")
    .trim();
}

function isDevModeTrigger(content) {
  const normalized = String(content || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");

  return (
    normalized === "dev mode" ||
    normalized === "developer mode" ||
    normalized === "enable dev mode" ||
    normalized === "turn on dev mode" ||
    normalized === "switch to dev mode"
  );
}

function isDisableDevModeTrigger(content) {
  const normalized = String(content || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");

  return (
    normalized === "normal mode" ||
    normalized === "disable dev mode" ||
    normalized === "turn off dev mode" ||
    normalized === "exit dev mode"
  );
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
  isDisableDevModeTrigger,
  isDevModeTrigger,
  stripBotMention,
};
