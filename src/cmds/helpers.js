const { PermissionFlagsBits } = require("discord.js");
const { OWNER_ID } = require("../config");

function isOwner(message) {
  return message.author.id === OWNER_ID;
}

function isModerator(message) {
  if (isOwner(message)) return true;
  if (!message.guild || !message.member) return false;
  return message.member.permissions.has(
    PermissionFlagsBits.BanMembers |
      PermissionFlagsBits.KickMembers |
      PermissionFlagsBits.ManageMessages |
      PermissionFlagsBits.Administrator,
  );
}

function isModeratorInteraction(interaction) {
  if (interaction.user.id === OWNER_ID) return true;
  if (!interaction.guild || !interaction.member) return false;
  return interaction.member.permissions.has(
    PermissionFlagsBits.BanMembers |
      PermissionFlagsBits.KickMembers |
      PermissionFlagsBits.ManageMessages |
      PermissionFlagsBits.Administrator,
  );
}

async function resolveTargetUser(message, args) {
  return (
    message.mentions.users.first() ||
    (args[0] ? await message.client.users.fetch(args[0]).catch(() => null) : null)
  );
}

function extractReason(args) {
  const rawReason = args.slice(1).join(" ").trim();
  return rawReason.replace(/^(for|because)\s+/i, "").trim() || "no reason";
}

async function sendInfractionDM(targetUser, type, reason, moderator, guildName) {
  const dmText =
    `You received a ${type} from Blaze${guildName ? ` in ${guildName}` : ""}.\nReason: ${reason}\nModerator: ${moderator.tag}`;
  try {
    const dm = await targetUser.createDM();
    await dm.send(dmText);
  } catch {
    // DM may be closed
  }
}

module.exports = {
  isOwner,
  isModerator,
  isModeratorInteraction,
  resolveTargetUser,
  extractReason,
  sendInfractionDM,
};
