const { EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const { ChatHistory, ConversationState, UserMemory } = require("../../db");
const { OWNER_ID, PREFIX, SUGGESTION_CHANNEL_ID } = require("../config");
const { buildHelpMessage } = require("./help");
const { appendToSystemPrompt } = require("../services/ai");
const { setDevMode } = require("../services/conversationState");
const {
  banUser,
  getBanInfo,
  getBannedUsers,
  getInfractionHistory,
  kickUser,
  unbanUser,
  warnUser,
} = require("../services/moderation");
const { getLoggedError, logError } = require("../state/errors");
const { getChatContext } = require("../utils/chatContext");

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
    `You received a ${type} from Blaze${guildName ? ` in ${guildName}` : ""}.
Reason: ${reason}
Moderator: ${moderator.tag}`;

  try {
    const dm = await targetUser.createDM();
    await dm.send(dmText);
  } catch (error) {
    // ignore DM failures, but allow command to continue
  }
}

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
    const errId = logError(error);
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
    const errId = logError(error);
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
    const errId = logError(error);
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
    const errId = logError(error);
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
      `**Ban Info for ${target.tag}**\n` +
        `Reason: ${mod.reason || "none"}\n` +
        `Banned By: <@${mod.bannedBy}>\n` +
        `Banned At: <t:${Math.floor(new Date(mod.bannedAt).getTime() / 1000)}:R>`,
    );
  } catch (error) {
    const errId = logError(error);
    return message.reply(`error id: \`${errId}\``);
  }
}

async function handleBanListCommand(message) {
  if (!isModerator(message)) return message.reply("nah");

  try {
    const bannedUsers = await getBannedUsers();

    if (!bannedUsers.length) {
      return message.reply("nobody's banned rn");
    }

    const lines = await Promise.all(
      bannedUsers.map(async (entry, index) => {
        const fetchedUser = await message.client.users.fetch(entry.userId).catch(() => null);
        const name = fetchedUser ? fetchedUser.tag : `unknown user (${entry.userId})`;
        const reason = entry.moderation?.reason || "no reason";
        return `${index + 1}. ${name} - ${reason}`;
      }),
    );

    return message.reply(`**Banned Users**\n${lines.join("\n")}`.slice(0, 1900));
  } catch (error) {
    const errId = logError(error);
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

    if (!infractions.length) {
      return message.reply(`${target.tag} has no recorded infractions.`);
    }

    const lines = infractions
      .slice(-25)
      .map((entry, index) => {
        return `${index + 1}. [${entry.type.toUpperCase()}] ${entry.reason || "no reason"} • <@${entry.moderatorId}> • <t:${Math.floor(new Date(entry.timestamp).getTime() / 1000)}:R>`;
      });

    return message.reply(
      `**Infractions for ${target.tag}**\n${lines.join("\n")}`.slice(0, 1900),
    );
  } catch (error) {
    const errId = logError(error);
    return message.reply(`error id: \`${errId}\``);
  }
}

async function handleDevModeCommand(message, args) {
  const chatContext = getChatContext(message);
  const shouldEnable = (args[0] || "on").toLowerCase() !== "off";

  try {
    await setDevMode(chatContext, shouldEnable);
    return message.reply(
      shouldEnable
        ? "dev mode on for this chat only. model: `llama-3.3-70b-versatile`"
        : "dev mode off for this chat. back to the normal model",
    );
  } catch (error) {
    const errId = logError(error);
    return message.reply(`error id: \`${errId}\``);
  }
}

async function handleErrorCommand(message, args) {
  const errorId = args[0];
  if (!errorId) return message.reply("gimme an error id rn");

  const log = getLoggedError(errorId);
  if (!log) return message.reply("couldn't find that error id tbh");

  return message.reply(
    `**Error ID: ${String(errorId).toUpperCase()}**\n` +
      `Time: <t:${Math.floor(log.time.getTime() / 1000)}:R>\n` +
      `Msg: ${log.message}\n` +
      `\`\`\`js\n${log.stack.substring(0, 1500)}\n\`\`\``,
  );
}

async function handleAddPromptCommand(message, args) {
  const addition = args.join(" ").trim();
  if (!addition) return message.reply("add something bro");

  appendToSystemPrompt(addition);
  return message.reply("dev cmd: successfully added to system prompt");
}

async function handleClearDbCommand(message) {
  try {
    await ChatHistory.deleteMany({});
    await UserMemory.deleteMany({});
    await ConversationState.deleteMany({});
    return message.reply("dev cmd: nuked the entire database (history, memory, chat settings)");
  } catch (error) {
    const errId = logError(error);
    return message.reply(`dev error id: \`${errId}\``);
  }
}

async function handleSendRulesCommand(message) {
  const embed = new EmbedBuilder()
    .setColor("fffd6a")
    .setTitle("Daffy Docs | Server Rules")
    .setDescription("Below, you'll find the rules for our community Discord.")
    .addFields(
      {
        name: "Discord ToS & Community Guidelines",
        value:
          "We uphold Discord's Guidelines and terms of service. you can find both articles, [Terms of Service](https://discord.com/terms) and [Community Guidelines](https://discord.com/guidelines)",
      },
      {
        name: "Respecting Staff",
        value:
          "Staff members are to be respected and listened to. **All members must abide by their instructions** ***as long as they don't break the rules***.",
      },
      {
        name: "Communication",
        value:
          "Members are requested to speak only English throughout all text channels. This helps the moderators and other staff to monitor the chats. (Greetings from other languages and other commonly known phrases are accepted).",
      },
      {
        name: "Spam & Text Walls",
        value:
          "Spamming, chat flooding, Text blocks (enormous blocks of text), or any oter conversation that causes disruption are strictly disallowed.",
      },
      {
        name: "Drama",
        value:
          "Do not argue or create drama or comments related to staff actions. Staff actions can be questioned by creating a ticket via <#1116326286927876137>. You are also asked to not talk about your punishments in any public chat.",
      },
      {
        name: "Trolling",
        value:
          "Do not Bait / troll. Baiting is when someone tries to intentionally make a person angry by saying or doing things to annoy / upset them. Trolling refers to the act of the chat, making a nuisance out of yourself, deliberately making others uncomfortable, or attempting to start trouble.",
      },
      {
        name: "Channel Use",
        value:
          "Use channels as they are intended. Breaking this rule may result in a warn or possibly a mute.",
      },
      {
        name: "Self Promotion",
        value:
          "No self promotion. This includes links to other Discord servers, YouTube / Twitch / Mixer channels, etc. (Do not self-promote in DMs, either). Self promotion in the server is a warning, then mute. DM advertising is an instant ban.",
      },
      {
        name: "Application Trolling",
        value:
          "Applications are there for people to apply, or to make an important decision (In that case a poll). Trolling these applications will lead to an instant kick from the server.",
      },
      {
        name: "Roles & Ranks",
        value:
          "Do not ask for any roles / ranks. Appropriate roles will be assigned by staff.",
      },
      {
        name: "Common Sense & Unlisted Rules",
        value:
          "Rules that aren't listed here but are common sense to be enforced can be enforced by staff. You may also get punished.",
      },
      {
        name: "Ear Rape & VC Surfing",
        value:
          "Do not surf voice channels. (Switching Channels repeatedly). Ear rape is the act of playing a high pitched sound that can hurt one's ears. Doing so will lead to an instant ban.",
      },
    );

  await message.channel.send({ embeds: [embed] });
}

async function handleSuggestionForumsCommand(message) {
  try {
    const channel = await message.client.channels.fetch(SUGGESTION_CHANNEL_ID);

    if (!channel || !channel.isThreadOnly()) {
      return message.reply("that channel isn't a forum channel bro");
    }

    await channel.threads.create({
      name: "Suggestion Guidelines",
      message: {
        content: `Welcome to the Suggestions channel.

In this forum you can post your suggestions for things you believe should be changed in the community. With this forum there are guidelines you must follow in order to avoid punishment.

- **All posts must be appropriate and not violate server rules.**
- **Your suggestion must not have already been suggested before.**
- **Respect others' opinions.**
- **Suggestions must be realistic and benefit the server.**`,
      },
    });

    return message.reply("posted suggestion guidelines");
  } catch (error) {
    const errId = logError(error);
    return message.reply(`failed to post. Error ID: \`${errId}\``);
  }
}

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
  if (command === "devmode" || command === "dev") return handleDevModeCommand(message, args);

  if (!isOwner(message)) return;

  if (command === "error") return handleErrorCommand(message, args);
  if (command === "addprompt") return handleAddPromptCommand(message, args);
  if (command === "cleardb") return handleClearDbCommand(message);
  if (command === "sendrules") return handleSendRulesCommand(message);
  if (command === "sforums") return handleSuggestionForumsCommand(message);
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
  if (!target) return message.reply("ping someone");

  const remaining = trimmed
    .slice(command.length)
    .replace(/<@!?(\d+)>/, "")
    .trim()
    .replace(/^(for|because)\s+/i, "")
    .trim();

  if (command === "warn") return !!(await handleWarnCommand(message, [target.id, remaining]));
  if (command === "kick") return !!(await handleKickCommand(message, [target.id, remaining]));
  if (command === "ban") return !!(await handleBanCommand(message, [target.id, remaining]));
  if (command === "unban") return !!(await handleUnbanCommand(message, [target.id]));
  if (command === "history" || command === "infractionhistory") return !!(await handleInfractionHistoryCommand(message, [target.id]));

  return false;
}

async function handleSlashCommand(interaction) {
  const command = interaction.commandName;
  const target = interaction.options.getUser("target");
  const reason = interaction.options.getString("reason") || "no reason";
  const mode = interaction.options.getString("mode");

  if (command === "help") {
    return interaction.reply(buildHelpMessage(interaction.user.id, isModeratorInteraction(interaction)));
  }

  if (command === "warn") {
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
      const errId = logError(error);
      return interaction.reply({ content: `error id: \`${errId}\``, ephemeral: true });
    }
  }

  if (command === "kick") {
    if (!isModeratorInteraction(interaction)) return interaction.reply({ content: "nah", ephemeral: true });
    if (!target) return interaction.reply({ content: "ping someone", ephemeral: true });

    try {
      await kickUser(target.id, interaction.user.id, reason, {
        guildId: interaction.guildId,
        channelId: interaction.channelId,
      });

      const member = interaction.guild ? await interaction.guild.members.fetch(target.id).catch(() => null) : null;
      if (member && member.kickable) {
        await member.kick(reason);
      }

      await sendInfractionDM(target, "kick", reason, interaction.user, interaction.guild?.name);
      return interaction.reply(`recorded kick for ${target.tag} and ${member ? "removed them from the guild" : "could not fetch member"}`);
    } catch (error) {
      const errId = logError(error);
      return interaction.reply({ content: `error id: \`${errId}\``, ephemeral: true });
    }
  }

  if (command === "ban") {
    if (!isModeratorInteraction(interaction)) return interaction.reply({ content: "nah", ephemeral: true });
    if (!target) return interaction.reply({ content: "ping someone", ephemeral: true });

    try {
      await banUser(target.id, interaction.user.id, reason, {
        guildId: interaction.guildId,
        channelId: interaction.channelId,
      });

      let banResult = null;
      if (interaction.guild) {
        banResult = await interaction.guild.bans.create(target.id, { reason }).catch(() => null);
      }

      await sendInfractionDM(target, "ban", reason, interaction.user, interaction.guild?.name);
      return interaction.reply(`recorded a ban for ${target.tag}${banResult ? " and banned them from the guild" : ""}`);
    } catch (error) {
      const errId = logError(error);
      return interaction.reply({ content: `error id: \`${errId}\``, ephemeral: true });
    }
  }

  if (command === "unban") {
    if (!isModeratorInteraction(interaction)) return interaction.reply({ content: "nah", ephemeral: true });
    if (!target) return interaction.reply({ content: "ping someone", ephemeral: true });

    try {
      const user = await unbanUser(target.id);
      if (!user) return interaction.reply({ content: "they weren't banned", ephemeral: true });
      if (interaction.guild) {
        await interaction.guild.members.unban(target.id).catch(() => null);
      }
      return interaction.reply(`unblocked ${target.tag}`);
    } catch (error) {
      const errId = logError(error);
      return interaction.reply({ content: `error id: \`${errId}\``, ephemeral: true });
    }
  }

  if (command === "history") {
    if (!isModeratorInteraction(interaction)) return interaction.reply({ content: "nah", ephemeral: true });
    if (!target) return interaction.reply({ content: "ping someone", ephemeral: true });

    try {
      const user = await getInfractionHistory(target.id);
      const infractions = user?.moderation?.infractions || [];
      if (!infractions.length) {
        return interaction.reply(`${target.tag} has no recorded infractions.`);
      }

      const lines = infractions
        .slice(-25)
        .map((entry, index) => `${index + 1}. [${entry.type.toUpperCase()}] ${entry.reason || "no reason"} • <@${entry.moderatorId}> • <t:${Math.floor(new Date(entry.timestamp).getTime() / 1000)}:R>`);

      return interaction.reply(`**Infractions for ${target.tag}**\n${lines.join("\n")}`.slice(0, 1900));
    } catch (error) {
      const errId = logError(error);
      return interaction.reply({ content: `error id: \`${errId}\``, ephemeral: true });
    }
  }

  if (command === "baninfo") {
    if (!isModeratorInteraction(interaction)) return interaction.reply({ content: "nah", ephemeral: true });
    if (!target) return interaction.reply({ content: "ping someone or give an id", ephemeral: true });

    try {
      const user = await getBanInfo(target.id);
      if (!user || !user.moderation?.banned) {
        return interaction.reply(`${target.tag} is not banned.`);
      }

      const mod = user.moderation;
      return interaction.reply(
        `**Ban Info for ${target.tag}**\n` +
          `Reason: ${mod.reason || "none"}\n` +
          `Banned By: <@${mod.bannedBy}>\n` +
          `Banned At: <t:${Math.floor(new Date(mod.bannedAt).getTime() / 1000)}:R>`,
      );
    } catch (error) {
      const errId = logError(error);
      return interaction.reply({ content: `error id: \`${errId}\``, ephemeral: true });
    }
  }

  if (command === "banlist") {
    if (!isModeratorInteraction(interaction)) return interaction.reply({ content: "nah", ephemeral: true });

    try {
      const bannedUsers = await getBannedUsers();
      if (!bannedUsers.length) {
        return interaction.reply("nobody's banned rn");
      }

      const lines = await Promise.all(
        bannedUsers.map(async (entry, index) => {
          const fetchedUser = await interaction.client.users.fetch(entry.userId).catch(() => null);
          const name = fetchedUser ? fetchedUser.tag : `unknown user (${entry.userId})`;
          const reason = entry.moderation?.reason || "no reason";
          return `${index + 1}. ${name} - ${reason}`;
        }),
      );

      return interaction.reply(`**Banned Users**\n${lines.join("\n")}`.slice(0, 1900));
    } catch (error) {
      const errId = logError(error);
      return interaction.reply({ content: `error id: \`${errId}\``, ephemeral: true });
    }
  }

  if (command === "devmode") {
    const shouldEnable = mode !== "off";
    const chatContext = getChatContext({
      author: interaction.user,
      channelId: interaction.channelId,
      guildId: interaction.guildId,
    });

    try {
      await setDevMode(chatContext, shouldEnable);
      return interaction.reply(
        shouldEnable
          ? "dev mode on for this chat only. model: `llama-3.3-70b-versatile`"
          : "dev mode off for this chat. back to the normal model",
      );
    } catch (error) {
      const errId = logError(error);
      return interaction.reply({ content: `error id: \`${errId}\``, ephemeral: true });
    }
  }

  if (command === "sendrules") {
    try {
      await handleSendRulesCommand({
        client: interaction.client,
        channel: interaction.channel,
        reply: (text) => interaction.reply(text),
      });
    } catch (error) {
      const errId = logError(error);
      return interaction.reply({ content: `error id: \`${errId}\``, ephemeral: true });
    }
  }

  if (command === "sforums") {
    try {
      await handleSuggestionForumsCommand({
        client: interaction.client,
        reply: (text) => interaction.reply(text),
      });
    } catch (error) {
      const errId = logError(error);
      return interaction.reply({ content: `error id: \`${errId}\``, ephemeral: true });
    }
  }

  if (command === "error") {
    if (interaction.user.id !== OWNER_ID) return interaction.reply({ content: "nah", ephemeral: true });
    const errorId = interaction.options.getString("id");
    if (!errorId) return interaction.reply({ content: "gimme an error id rn", ephemeral: true });

    const log = getLoggedError(errorId);
    if (!log) return interaction.reply({ content: "couldn't find that error id tbh", ephemeral: true });

    return interaction.reply(
      `**Error ID: ${String(errorId).toUpperCase()}**\n` +
        `Time: <t:${Math.floor(log.time.getTime() / 1000)}:R>\n` +
        `Msg: ${log.message}\n` +
        `\
\\`js\n${log.stack.substring(0, 1500)}\n\
\\``,
    );
  }

  if (command === "addprompt") {
    if (interaction.user.id !== OWNER_ID) return interaction.reply({ content: "nah", ephemeral: true });
    const addition = interaction.options.getString("text");
    if (!addition) return interaction.reply({ content: "add something bro", ephemeral: true });

    appendToSystemPrompt(addition);
    return interaction.reply("dev cmd: successfully added to system prompt");
  }

  if (command === "cleardb") {
    if (interaction.user.id !== OWNER_ID) return interaction.reply({ content: "nah", ephemeral: true });

    try {
      await ChatHistory.deleteMany({});
      await UserMemory.deleteMany({});
      await ConversationState.deleteMany({});
      return interaction.reply("dev cmd: nuked the entire database (history, memory, chat settings)");
    } catch (error) {
      const errId = logError(error);
      return interaction.reply({ content: `dev error id: \`${errId}\``, ephemeral: true });
    }
  }

  return interaction.reply({ content: "command not implemented yet", ephemeral: true });
}

module.exports = {
  handlePrefixCommand,
  handleMentionCommand,
  handleSlashCommand,
};
