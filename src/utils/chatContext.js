function getChatContext(message) {
  const channelId = message.channelId || message.channel?.id || "unknown-channel";
  const guildId = message.guildId || message.guild?.id || null;
  const userId = message.author.id;

  return {
    chatKey: `${channelId}:${userId}`,
    channelId,
    guildId,
    userId,
  };
}

module.exports = {
  getChatContext,
};
