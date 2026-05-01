const { OWNER_ID, PREFIX } = require("../config");

function buildHelpMessage(authorId, isMod) {
  let helpMsg =
    `**Blaze Commands:**\n` +
    `- \`${PREFIX}help\` - Shows this message\n` +
    `- \`${PREFIX}devmode [on|off]\` - Switches dev mode for your current chat only\n` +
    `- Reply to Blaze to continue the convo without pinging him again`;

  if (isMod) {
    helpMsg +=
      `\n\n**Moderation Commands:**\n` +
      `- \`${PREFIX}warn @user [reason]\` - Warns a user\n` +
      `- \`${PREFIX}kick @user [reason]\` - Kicks a user and records the infraction\n` +
      `- \`${PREFIX}ban @user [reason]\` - Bans a user and records the infraction\n` +
      `- \`${PREFIX}unban @user\` - Unbans a user\n` +
      `- \`${PREFIX}history @user\` - Shows a user's infraction history\n` +
      `- \`${PREFIX}banlist\` - Lists recorded ban infractions\n` +
      `- You can also mention Blaze directly with mod commands like \`@blaze warn @user [reason]\`\n`;
  }

  if (authorId === OWNER_ID) {
    helpMsg +=
      `\n\n**Dev Commands:**\n` +
      `- \`${PREFIX}addprompt <text>\` - Appends to my system prompt\n` +
      `- \`${PREFIX}cleardb\` - Nukes all chat history and memories\n` +
      `- \`${PREFIX}error <id>\` - Look up an error ID`;
  }

  return helpMsg;
}

module.exports = {
  buildHelpMessage,
};
