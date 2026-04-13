const { OWNER_ID, PREFIX } = require("../config");

function buildHelpMessage(authorId) {
  let helpMsg =
    `**Blaze Commands:**\n` +
    `- \`${PREFIX}help\` - Shows this message\n` +
    `- \`${PREFIX}devmode [on|off]\` - Switches dev mode for your current chat only\n` +
    `- \`${PREFIX}ban @user [reason]\` - Bans a user\n` +
    `- \`${PREFIX}unban @user\` - Unbans a user\n` +
    `- \`${PREFIX}banlist\` - Lists everyone banned from Blaze\n` +
    `- Reply to Blaze to continue the convo without pinging him again`;

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
