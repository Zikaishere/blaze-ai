const { Client, GatewayIntentBits, Partials, PermissionFlagsBits } = require("discord.js");
const { connectDB } = require("../db");
const { getPrefix, getEffectiveConfig } = require("./services/config");
const { OWNER_ID } = require("./config");
const { handlePrefixCommand, handleMentionCommand, handleSlashCommand } = require("./cmds/handlers");
const { slashCommands } = require("./cmds/slashCommands");
const { getResponse, loadSystemPrompt } = require("./services/ai");
const { isOnCooldown, setCooldown } = require("./state/cooldowns");
const { logError } = require("./state/errors");
const { getChatContext } = require("./utils/chatContext");
const {
  isBotConversationMessage,
  stripBotMention,
} = require("./utils/messageRouting");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

client.once("ready", async () => {
  console.log(`Blaze is online as ${client.user.tag}`);
  client.user.setPresence({
    activities: [{ name: "jus chillin, ping me if u need sum", type: 0 }],
    status: "idle",
  });

  try {
    if (client.application) {
      if (process.env.GUILD_ID) {
        await client.application.commands.set(slashCommands, process.env.GUILD_ID);
      } else {
        await client.application.commands.set(slashCommands);
      }
      console.log("Slash commands registered");
    }
  } catch (error) {
    console.error("Failed to register slash commands", error);
  }
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {
    await handleSlashCommand(interaction);
  } catch (error) {
    const errId = await logError(error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(`bro idk what just happened. Error ID: \`${errId}\``);
    } else {
      await interaction.reply(`bro idk what just happened. Error ID: \`${errId}\``);
    }
  }
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  const isDirectMessage =
    message.channel?.isDMBased?.() ||
    (typeof message.inGuild === "function"
      ? !message.inGuild()
      : !message.guildId && !message.guild);

  if (isDirectMessage) {
    console.log(`Received DM from ${message.author.tag} (${message.author.id})`);
  }

  const prefix = await getPrefix(message.guildId);
  const contentLower = message.content.toLowerCase();
  if (contentLower.startsWith(prefix.toLowerCase())) {
    await handlePrefixCommand(message);
    return;
  }

  const routing = isBotConversationMessage(message, client.user.id);
  if (!routing.shouldHandle) return;

  const mentionText = stripBotMention(message.content, client.user.id);
  const handled = await handleMentionCommand(message, mentionText);
  if (handled) return;

  const chatContext = getChatContext(message);
  const config = await getEffectiveConfig(message.guildId, message.author.id);

  if (!config.aiEnabled) return;
  if (config.allowedChannels.length > 0 && message.guildId && !config.allowedChannels.includes(message.channelId)) return;

  if (isOnCooldown(message.author.id, config.cooldownMs)) return;
  setCooldown(message.author.id, config.cooldownMs);

  let userMessage = stripBotMention(message.content, client.user.id);
  if (!userMessage) return message.reply("yeah?");

  const parsed = parseOverrides(userMessage, message.author.id, message.guild, message.member);
  userMessage = parsed.clean;
  Object.assign(config, parsed.overrides);

  try {
    await message.channel.sendTyping().catch(() => null);

    const userName =
      message.member?.displayName ||
      message.author.globalName ||
      message.author.username;

    const response = await getResponse(chatContext, userName, userMessage, config);
    await sendChunkedReply(message, response.reply);
  } catch (error) {
    const errId = await logError(error);
    await message.reply(`bro idk what just happened. Error ID: \`${errId}\``);
  }
});

function parseOverrides(text, userId, guild, member) {
  const overrides = {};
  const isDev = userId === OWNER_ID;
  const isAdmin = isDev || (guild && member?.permissions.has(PermissionFlagsBits.Administrator));

  const adminFlags = [
    { pattern: /--no-memory\b/gi, apply: () => { overrides.memoryEnabled = false; } },
    { pattern: /--long\b/gi, apply: () => { overrides.maxTokens = 1000; } },
    { pattern: /--short\b/gi, apply: () => { overrides.maxTokens = 150; } },
    { pattern: /--exact\b/gi, apply: () => { overrides.temperature = 0.3; } },
    { pattern: /--creative\b/gi, apply: () => { overrides.temperature = 1.2; } },
  ];

  const devFlags = [
    { pattern: /--model\s+(\S+)/gi, apply: (_, m) => { overrides.model = m; } },
    { pattern: /--temp\s+([\d.]+)/gi, apply: (_, v) => { overrides.temperature = parseFloat(v); } },
    { pattern: /--tokens\s+(\d+)/gi, apply: (_, n) => { overrides.maxTokens = parseInt(n, 10); } },
  ];

  let clean = text;
  for (const { pattern, apply } of adminFlags) {
    if (isAdmin) {
      clean = clean.replace(pattern, (match, ...groups) => { apply(match, ...groups); return ""; });
    } else {
      clean = clean.replace(pattern, "");
    }
  }
  for (const { pattern, apply } of devFlags) {
    if (isDev) {
      clean = clean.replace(pattern, (match, ...groups) => { apply(match, ...groups); return ""; });
    } else {
      clean = clean.replace(pattern, "");
    }
  }

  return { clean: clean.replace(/\s+/g, " ").trim(), overrides };
}

async function sendChunkedReply(message, text) {
  const maxLen = 2000;
  if (text.length <= maxLen) {
    await message.reply(text);
    return;
  }

  const chunks = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }

    let splitAt = remaining.lastIndexOf("\n", maxLen);
    if (splitAt < maxLen * 0.5) {
      splitAt = remaining.lastIndexOf(" ", maxLen);
    }
    if (splitAt < maxLen * 0.5) {
      splitAt = maxLen;
    }

    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).trim();
  }

  await message.reply(chunks[0]);
  for (let i = 1; i < chunks.length; i++) {
    await message.channel.send(chunks[i]);
  }
}

async function startBot() {
  await connectDB();
  await loadSystemPrompt();
  await client.login(process.env.DISCORD_TOKEN);
}

module.exports = {
  startBot,
};
