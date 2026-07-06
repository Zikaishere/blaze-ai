const {
  banUser,
  getBanInfo,
  getBannedUsers,
  getInfractionHistory,
  kickUser,
  unbanUser,
  warnUser,
} = require("../services/moderation");
const { logError } = require("../state/errors");
const {
  isModerator,
  isModeratorInteraction,
  resolveTargetUser,
  extractReason,
  sendInfractionDM,
} = require("./helpers");

async function handleWarnCommand(message, args) {
  if (!isModerator(message)) return message.reply("nah");
  const target = await resolveTargetUser(message, args);
  if (!target) return message.reply("ping someone");
  const reason = extractReason(args);
  try {
    await warnUser(target.id, message.author.id, reason, {
      guildId: message.guildId,
      channelId: message.channelId,
    });
    await sendInfractionDM(target, "warning", reason, message.author, message.guild?.name);
    return message.reply(`warned ${target.tag} for ${reason}`);
  } catch (error) {
    const errId = await logError(error);
    return message.reply(`error id: \`${errId}\``);
  }
}

async function handleKickCommand(message, args) {
  if (!isModerator(message)) return message.reply("nah");
  const target = await resolveTargetUser(message, args);
  if (!target) return message.reply("ping someone");
  const reason = extractReason(args);
  try {
    await kickUser(target.id, message.author.id, reason, {
      guildId: message.guildId,
      channelId: message.channelId,
    });
    const member = message.guild ? await message.guild.members.fetch(target.id).catch(() => null) : null;
    if (member && member.kickable) {
      await member.kick(reason);
    }
    await sendInfractionDM(target, "kick", reason, message.author, message.guild?.name);
    return message.reply(`recorded kick for ${target.tag} and ${member ? "removed them from the guild" : "could not fetch member"}`);
  } catch (error) {
    const errId = await logError(error);
    return message.reply(`error id: \`${errId}\``);
  }
}

async function handleBanCommand(message, args) {
  if (!isModerator(message)) return message.reply("nah");
  const target = await resolveTargetUser(message, args);
  if (!target) return message.reply("ping someone");
  const reason = extractReason(args);
  try {
    await banUser(target.id, message.author.id, reason, {
      guildId: message.guildId,
      channelId: message.channelId,
    });
    let banResult = null;
    if (message.guild) {
      banResult = await message.guild.bans.create(target.id, { reason }).catch(() => null);
    }
    await sendInfractionDM(target, "ban", reason, message.author, message.guild?.name);
    return message.reply(`recorded a ban for ${target.tag}${banResult ? " and banned them from the guild" : ""}`);
  } catch (error) {
    const errId = await logError(error);
    return message.reply(`error id: \`${errId}\``);
  }
}

async function handleUnbanCommand(message, args) {
  if (!isModerator(message)) return message.reply("nah");
  const target = await resolveTargetUser(message, args);
  if (!target) return message.reply("ping someone");
  try {
    const user = await unbanUser(target.id);
    if (!user) return message.reply("they weren't banned");
    if (message.guild) {
      await message.guild.members.unban(target.id).catch(() => null);
    }
    return message.reply(`unblocked ${target.tag}`);
  } catch (error) {
    const errId = await logError(error);
    return message.reply(`error id: \`${errId}\``);
  }
}

async function handleBanInfoCommand(message, args) {
  if (!isModerator(message)) return message.reply("nah");
  const target = await resolveTargetUser(message, args);
  if (!target) return message.reply("ping someone or give an id");
  try {
    const user = await getBanInfo(target.id);
    if (!user || !user.moderation?.banned) {
      return message.reply(`${target.tag} is not banned.`);
    }
    const mod = user.moderation;
    return message.reply(
      `**Ban Info for ${target.tag}**\nReason: ${mod.reason || "none"}\nBanned By: <@${mod.bannedBy}>\nBanned At: <t:${Math.floor(new Date(mod.bannedAt).getTime() / 1000)}:R>`,
    );
  } catch (error) {
    const errId = await logError(error);
    return message.reply(`error id: \`${errId}\``);
  }
}

async function handleBanListCommand(message) {
  if (!isModerator(message)) return message.reply("nah");
  try {
    const bannedUsers = await getBannedUsers();
    if (!bannedUsers.length) return message.reply("nobody's banned rn");
    const lines = await Promise.all(
      bannedUsers.map(async (entry, index) => {
        const fetchedUser = await message.client.users.fetch(entry.userId).catch(() => null);
        const name = fetchedUser ? fetchedUser.tag : `unknown user (${entry.userId})`;
        return `${index + 1}. ${name} - ${entry.moderation?.reason || "no reason"}`;
      }),
    );
    return message.reply(`**Banned Users**\n${lines.join("\n")}`.slice(0, 1900));
  } catch (error) {
    const errId = await logError(error);
    return message.reply(`error id: \`${errId}\``);
  }
}

async function handleInfractionHistoryCommand(message, args) {
  if (!isModerator(message)) return message.reply("nah");
  const target = await resolveTargetUser(message, args);
  if (!target) return message.reply("ping someone");
  try {
    const user = await getInfractionHistory(target.id);
    const infractions = user?.moderation?.infractions || [];
    if (!infractions.length) return message.reply(`${target.tag} has no recorded infractions.`);
    const lines = infractions.slice(-25).map((entry, index) =>
      `${index + 1}. [${entry.type.toUpperCase()}] ${entry.reason || "no reason"} • <@${entry.moderatorId}> • <t:${Math.floor(new Date(entry.timestamp).getTime() / 1000)}:R>`,
    );
    return message.reply(`**Infractions for ${target.tag}**\n${lines.join("\n")}`.slice(0, 1900));
  } catch (error) {
    const errId = await logError(error);
    return message.reply(`error id: \`${errId}\``);
  }
}

async function handleSlashWarn(interaction, target, reason) {
  if (!isModeratorInteraction(interaction)) return interaction.reply({ content: "nah", ephemeral: true });
  if (!target) return interaction.reply({ content: "ping someone", ephemeral: true });
  try {
    await warnUser(target.id, interaction.user.id, reason, {
      guildId: interaction.guildId,
      channelId: interaction.channelId,
    });
    await sendInfractionDM(target, "warning", reason, interaction.user, interaction.guild?.name);
    return interaction.reply(`warned ${target.tag} for ${reason}`);
  } catch (error) {
    const errId = await logError(error);
    return interaction.reply({ content: `error id: \`${errId}\``, ephemeral: true });
  }
}

async function handleSlashKick(interaction, target, reason) {
  if (!isModeratorInteraction(interaction)) return interaction.reply({ content: "nah", ephemeral: true });
  if (!target) return interaction.reply({ content: "ping someone", ephemeral: true });
  try {
    await kickUser(target.id, interaction.user.id, reason, {
      guildId: interaction.guildId,
      channelId: interaction.channelId,
    });
    const member = interaction.guild ? await interaction.guild.members.fetch(target.id).catch(() => null) : null;
    if (member && member.kickable) await member.kick(reason);
    await sendInfractionDM(target, "kick", reason, interaction.user, interaction.guild?.name);
    return interaction.reply(`recorded kick for ${target.tag} and ${member ? "removed them from the guild" : "could not fetch member"}`);
  } catch (error) {
    const errId = await logError(error);
    return interaction.reply({ content: `error id: \`${errId}\``, ephemeral: true });
  }
}

async function handleSlashBan(interaction, target, reason) {
  if (!isModeratorInteraction(interaction)) return interaction.reply({ content: "nah", ephemeral: true });
  if (!target) return interaction.reply({ content: "ping someone", ephemeral: true });
  try {
    await banUser(target.id, interaction.user.id, reason, {
      guildId: interaction.guildId,
      channelId: interaction.channelId,
    });
    let banResult = null;
    if (interaction.guild) banResult = await interaction.guild.bans.create(target.id, { reason }).catch(() => null);
    await sendInfractionDM(target, "ban", reason, interaction.user, interaction.guild?.name);
    return interaction.reply(`recorded a ban for ${target.tag}${banResult ? " and banned them from the guild" : ""}`);
  } catch (error) {
    const errId = await logError(error);
    return interaction.reply({ content: `error id: \`${errId}\``, ephemeral: true });
  }
}

async function handleSlashUnban(interaction, target) {
  if (!isModeratorInteraction(interaction)) return interaction.reply({ content: "nah", ephemeral: true });
  if (!target) return interaction.reply({ content: "ping someone", ephemeral: true });
  try {
    const user = await unbanUser(target.id);
    if (!user) return interaction.reply({ content: "they weren't banned", ephemeral: true });
    if (interaction.guild) await interaction.guild.members.unban(target.id).catch(() => null);
    return interaction.reply(`unblocked ${target.tag}`);
  } catch (error) {
    const errId = await logError(error);
    return interaction.reply({ content: `error id: \`${errId}\``, ephemeral: true });
  }
}

async function handleSlashHistory(interaction, target) {
  if (!isModeratorInteraction(interaction)) return interaction.reply({ content: "nah", ephemeral: true });
  if (!target) return interaction.reply({ content: "ping someone", ephemeral: true });
  try {
    const user = await getInfractionHistory(target.id);
    const infractions = user?.moderation?.infractions || [];
    if (!infractions.length) return interaction.reply(`${target.tag} has no recorded infractions.`);
    const lines = infractions.slice(-25).map((entry, index) =>
      `${index + 1}. [${entry.type.toUpperCase()}] ${entry.reason || "no reason"} • <@${entry.moderatorId}> • <t:${Math.floor(new Date(entry.timestamp).getTime() / 1000)}:R>`,
    );
    return interaction.reply(`**Infractions for ${target.tag}**\n${lines.join("\n")}`.slice(0, 1900));
  } catch (error) {
    const errId = await logError(error);
    return interaction.reply({ content: `error id: \`${errId}\``, ephemeral: true });
  }
}

async function handleSlashBanInfo(interaction, target) {
  if (!isModeratorInteraction(interaction)) return interaction.reply({ content: "nah", ephemeral: true });
  if (!target) return interaction.reply({ content: "ping someone or give an id", ephemeral: true });
  try {
    const user = await getBanInfo(target.id);
    if (!user || !user.moderation?.banned) return interaction.reply(`${target.tag} is not banned.`);
    const mod = user.moderation;
    return interaction.reply(
      `**Ban Info for ${target.tag}**\nReason: ${mod.reason || "none"}\nBanned By: <@${mod.bannedBy}>\nBanned At: <t:${Math.floor(new Date(mod.bannedAt).getTime() / 1000)}:R>`,
    );
  } catch (error) {
    const errId = await logError(error);
    return interaction.reply({ content: `error id: \`${errId}\``, ephemeral: true });
  }
}

async function handleSlashBanList(interaction) {
  if (!isModeratorInteraction(interaction)) return interaction.reply({ content: "nah", ephemeral: true });
  try {
    const bannedUsers = await getBannedUsers();
    if (!bannedUsers.length) return interaction.reply("nobody's banned rn");
    const lines = await Promise.all(
      bannedUsers.map(async (entry, index) => {
        const fetchedUser = await interaction.client.users.fetch(entry.userId).catch(() => null);
        const name = fetchedUser ? fetchedUser.tag : `unknown user (${entry.userId})`;
        return `${index + 1}. ${name} - ${entry.moderation?.reason || "no reason"}`;
      }),
    );
    return interaction.reply(`**Banned Users**\n${lines.join("\n")}`.slice(0, 1900));
  } catch (error) {
    const errId = await logError(error);
    return interaction.reply({ content: `error id: \`${errId}\``, ephemeral: true });
  }
}

module.exports = {
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
};
