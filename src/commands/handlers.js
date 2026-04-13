const { EmbedBuilder } = require("discord.js");
const { ChatHistory, ConversationState, UserMemory } = require("../../db");
const { OWNER_ID, PREFIX, SUGGESTION_CHANNEL_ID } = require("../config");
const { buildHelpMessage } = require("./help");
const { appendToSystemPrompt } = require("../services/ai");
const { setDevMode } = require("../services/conversationState");
const {
  banUser,
  getBanInfo,
  getBannedUsers,
  unbanUser,
} = require("../services/moderation");
const { getLoggedError, logError } = require("../state/errors");
const { getChatContext } = require("../utils/chatContext");

function isOwner(message) {
  return message.author.id === OWNER_ID;
}

async function resolveTargetUser(message, args) {
  return (
    message.mentions.users.first() ||
    (args[0] ? await message.client.users.fetch(args[0]).catch(() => null) : null)
  );
}

async function handleBanCommand(message, args) {
  if (!isOwner(message)) return message.reply("nah");

  const target = message.mentions.users.first();
  if (!target) return message.reply("ping someone");

  const reason = args.slice(1).join(" ") || "no reason";

  try {
    await banUser(target.id, message.author.id, reason);
    return message.reply(`blocked ${target.tag} from using blaze`);
  } catch (error) {
    const errId = logError(error);
    return message.reply(`error id: \`${errId}\``);
  }
}

async function handleUnbanCommand(message) {
  if (!isOwner(message)) return message.reply("nah");

  const target = message.mentions.users.first();
  if (!target) return message.reply("ping someone");

  try {
    const user = await unbanUser(target.id);
    if (!user) return message.reply("they weren't banned");
    return message.reply(`unblocked ${target.tag}`);
  } catch (error) {
    const errId = logError(error);
    return message.reply(`error id: \`${errId}\``);
  }
}

async function handleBanInfoCommand(message, args) {
  if (!isOwner(message)) return message.reply("nah");

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
  if (!isOwner(message)) return message.reply("nah");

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

  if (command === "help") return message.reply(buildHelpMessage(message.author.id));
  if (command === "ban") return handleBanCommand(message, args);
  if (command === "unban") return handleUnbanCommand(message, args);
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

module.exports = {
  handlePrefixCommand,
};
