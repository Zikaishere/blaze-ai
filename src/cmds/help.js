const { EmbedBuilder } = require("discord.js");
const { OWNER_ID } = require("../config");

function buildHelpEmbed(authorId, isMod, prefix) {
  const p = prefix || "b.";

  const embed = new EmbedBuilder()
    .setColor(0xff6a00)
    .setTitle("Blaze Commands")
    .setDescription("chaotic ai energy, now in your server")
    .addFields(
      {
        name: "💬 Chat",
        value:
          `- \`${p}help\` — this message\n` +
          `- \`${p}config\` — view/change settings\n` +
          `- \`${p}config style <style>\` — set your chat style\n` +
          `- \`${p}config memory on/off\` — toggle memory for yourself\n` +
          `- \`${p}fact add <text>\` — save a fact about yourself\n` +
          `- Ping me or reply to talk\n` +
          `- DM me to chat privately`,
        inline: false,
      },
    );

  if (isMod) {
    embed.addFields({
      name: "🛡️ Moderation",
      value:
        `- \`${p}warn @user [reason]\` — warn a user\n` +
        `- \`${p}kick @user [reason]\` — kick + record infraction\n` +
        `- \`${p}ban @user [reason]\` — ban + record infraction\n` +
        `- \`${p}unban @user\` — unban a user\n` +
        `- \`${p}history @user\` — view infractions\n` +
        `- \`${p}banlist\` — list all banned users\n` +
        `- \`${p}config prefix <new>\` — change server prefix\n` +
        `- Mention me directly too: \`@Blaze warn @user [reason]\``,
      inline: false,
    });
  }

  if (authorId === OWNER_ID) {
    embed.addFields({
      name: "⚙️ Owner",
      value:
        `- \`${p}config model <name>\` — change model for this server\n` +
        `- \`${p}config prompt <text>\` — add server prompt addition\n` +
        `- \`${p}addprompt <text>\` — append to global system prompt\n` +
        `- \`${p}cleardb\` — wipe all history & memories\n` +
        `- \`${p}error <id>\` — look up an error by ID`,
      inline: false,
    });
  }

  embed.setFooter({ text: "blaze ai • the chaotic energy you didnt ask for" });
  return embed;
}

module.exports = {
  buildHelpEmbed,
};
