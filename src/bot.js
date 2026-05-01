const { Client, GatewayIntentBits } = require("discord.js");
const { connectDB } = require("../db");
const { PREFIX } = require("./config");
const { handlePrefixCommand, handleMentionCommand, handleSlashCommand } = require("./cmds/handlers");
const { slashCommands } = require("./cmds/slashCommands");
const { getResponse } = require("./services/ai");
const { setDevMode } = require("./services/conversationState");
const { getUserMemory } = require("./services/memory");
const { isOnCooldown, setCooldown } = require("./state/cooldowns");
const { logError } = require("./state/errors");
const { getChatContext } = require("./utils/chatContext");
const {
  isBotConversationMessage,
  isDisableDevModeTrigger,
  isDevModeTrigger,
  stripBotMention,
} = require("./utils/messageRouting");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
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
    const errId = logError(error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(`bro idk what just happened. Error ID: \`${errId}\``);
    } else {
      await interaction.reply(`bro idk what just happened. Error ID: \`${errId}\``);
    }
  }
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

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
  const userData = await getUserMemory(message.author.id);

  if (isOnCooldown(message.author.id)) return;
  setCooldown(message.author.id);

  const userMessage = stripBotMention(message.content, client.user.id);
  if (!userMessage) return message.reply("yeah?");

  if (isDevModeTrigger(userMessage)) {
    try {
      await setDevMode(chatContext, true);
      return message.reply(
        "dev mode on for this chat only. using `llama-3.3-70b-versatile` now",
      );
    } catch (error) {
      const errId = logError(error);
      return message.reply(`bro idk what just happened. Error ID: \`${errId}\``);
    }
  }

  if (isDisableDevModeTrigger(userMessage)) {
    try {
      await setDevMode(chatContext, false);
      return message.reply("aight dev mode off for this chat");
    } catch (error) {
      const errId = logError(error);
      return message.reply(`bro idk what just happened. Error ID: \`${errId}\``);
    }
  }

  await message.channel.sendTyping();

  try {
    const userName =
      message.member?.displayName ||
      message.author.globalName ||
      message.author.username;

    const response = await getResponse(chatContext, userName, userMessage);
    await message.reply(response.reply);
  } catch (error) {
    const errId = logError(error);
    await message.reply(`bro idk what just happened. Error ID: \`${errId}\``);
  }
});

async function startBot() {
  await connectDB();
  await client.login(process.env.DISCORD_TOKEN);
}

module.exports = {
  startBot,
};
