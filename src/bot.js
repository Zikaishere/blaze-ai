const { Client, GatewayIntentBits, Partials } = require("discord.js");
const { connectDB } = require("../db");
const { PREFIX } = require("./config");
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

  const contentLower = message.content.toLowerCase();
  if (contentLower.startsWith(PREFIX)) {
    await handlePrefixCommand(message);
    return;
  }

  const routing = isBotConversationMessage(message, client.user.id);
  if (!routing.shouldHandle) return;

  const mentionText = stripBotMention(message.content, client.user.id);
  const handled = await handleMentionCommand(message, mentionText);
  if (handled) return;

  const chatContext = getChatContext(message);

  if (isOnCooldown(message.author.id)) return;
  setCooldown(message.author.id);

  const userMessage = stripBotMention(message.content, client.user.id);
  if (!userMessage) return message.reply("yeah?");

  try {
    await message.channel.sendTyping().catch(() => null);

    const userName =
      message.member?.displayName ||
      message.author.globalName ||
      message.author.username;

    const response = await getResponse(chatContext, userName, userMessage);
    await sendChunkedReply(message, response.reply);
  } catch (error) {
    const errId = await logError(error);
    await message.reply(`bro idk what just happened. Error ID: \`${errId}\``);
  }
});

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
