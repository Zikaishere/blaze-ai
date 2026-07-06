const { PREFIX } = require("../config");
const { buildHelpMessage } = require("./help");
const {
  isOwner,
  isModerator,
  isModeratorInteraction,
  resolveTargetUser,
} = require("./helpers");
const {
  handleWarnCommand,
  handleKickCommand,
  handleBanCommand,
  handleUnbanCommand,
  handleBanInfoCommand,
  handleBanListCommand,
  handleInfractionHistoryCommand,
  handleSlashWarn,
  handleSlashKick,
  handleSlashBan,
  handleSlashUnban,
  handleSlashHistory,
  handleSlashBanInfo,
  handleSlashBanList,
} = require("./moderation");
const {
  handleErrorCommand,
  handleAddPromptCommand,
  handleClearDbCommand,
  handleSlashError,
  handleSlashAddPrompt,
  handleSlashClearDb,
} = require("./owner");

async function handlePrefixCommand(message) {
  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = (args.shift() || "").toLowerCase();

  if (command === "help") return message.reply(buildHelpMessage(message.author.id, isModerator(message)));
  if (command === "warn") return handleWarnCommand(message, args);
  if (command === "kick") return handleKickCommand(message, args);
  if (command === "ban") return handleBanCommand(message, args);
  if (command === "unban") return handleUnbanCommand(message, args);
  if (command === "history" || command === "infractionhistory") return handleInfractionHistoryCommand(message, args);
  if (command === "baninfo") return handleBanInfoCommand(message, args);
  if (command === "banlist") return handleBanListCommand(message);

  if (!isOwner(message)) return;

  if (command === "error") return handleErrorCommand(message, args);
  if (command === "addprompt") return handleAddPromptCommand(message, args);
  if (command === "cleardb") return handleClearDbCommand(message);
}

async function handleMentionCommand(message, text) {
  const trimmed = text.trim();
  const parts = trimmed.split(/ +/).filter(Boolean);
  const command = parts[0]?.toLowerCase();
  if (!command) return false;

  const mentionCommands = new Set(["warn", "kick", "ban", "unban", "history", "infractionhistory"]);
  if (!mentionCommands.has(command)) return false;

  const args = parts.slice(1);
  const target = await resolveTargetUser(message, args);
  if (!target) {
    await message.reply("ping someone");
    return true;
  }

  const remaining = trimmed
    .slice(command.length)
    .replace(/<@!?(\d+)>/, "")
    .trim()
    .replace(/^(for|because)\s+/i, "")
    .trim();

  const modArgs = [target.id, remaining];
  if (command === "warn") { await handleWarnCommand(message, modArgs); return true; }
  if (command === "kick") { await handleKickCommand(message, modArgs); return true; }
  if (command === "ban") { await handleBanCommand(message, modArgs); return true; }
  if (command === "unban") { await handleUnbanCommand(message, [target.id]); return true; }
  if (command === "history" || command === "infractionhistory") { await handleInfractionHistoryCommand(message, [target.id]); return true; }

  return false;
}

async function handleSlashCommand(interaction) {
  const command = interaction.commandName;
  const target = interaction.options.getUser("target");
  const reason = interaction.options.getString("reason") || "no reason";

  if (command === "help") {
    return interaction.reply(buildHelpMessage(interaction.user.id, isModeratorInteraction(interaction)));
  }
  if (command === "warn") return handleSlashWarn(interaction, target, reason);
  if (command === "kick") return handleSlashKick(interaction, target, reason);
  if (command === "ban") return handleSlashBan(interaction, target, reason);
  if (command === "unban") return handleSlashUnban(interaction, target);
  if (command === "history") return handleSlashHistory(interaction, target);
  if (command === "baninfo") return handleSlashBanInfo(interaction, target);
  if (command === "banlist") return handleSlashBanList(interaction);
  if (command === "error") return handleSlashError(interaction);
  if (command === "addprompt") return handleSlashAddPrompt(interaction);
  if (command === "cleardb") return handleSlashClearDb(interaction);
}

module.exports = {
  handlePrefixCommand,
  handleMentionCommand,
  handleSlashCommand,
};
