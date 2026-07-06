const { EmbedBuilder } = require("discord.js");
const { ChatHistory, ConversationState, UserMemory } = require("../../db");
const { appendToSystemPrompt } = require("../services/ai");
const { getLoggedError, logError } = require("../state/errors");
const { isOwner } = require("./helpers");

async function handleErrorCommand(message, args) {
  const errorId = args[0];
  if (!errorId) {
    const embed = new EmbedBuilder().setColor("FF0000").setDescription("Please provide an error ID.");
    return message.reply({ embeds: [embed] });
  }
  const log = await getLoggedError(errorId);
  if (!log) {
    const embed = new EmbedBuilder().setColor("FF0000").setDescription("Error ID not found.");
    return message.reply({ embeds: [embed] });
  }
  const errorTime = Math.floor(log.time.getTime() / 1000);
  const embed = new EmbedBuilder()
    .setColor("FF0000")
    .setTitle(`Error ID: ${String(errorId).toUpperCase()}`)
    .addFields(
      { name: "Time", value: `<t:${errorTime}:R>`, inline: true },
      { name: "Message", value: log.message, inline: false },
      { name: "Stack Trace", value: `\`\`\`js\n${log.stack.substring(0, 1500)}\n\`\`\``, inline: false },
    );
  return message.reply({ embeds: [embed] });
}

async function handleAddPromptCommand(message, args) {
  const addition = args.join(" ").trim();
  if (!addition) return message.reply("add something bro");
  await appendToSystemPrompt(addition);
  return message.reply("added to system prompt and saved");
}

async function handleClearDbCommand(message) {
  try {
    await ChatHistory.deleteMany({});
    await UserMemory.deleteMany({});
    await ConversationState.deleteMany({});
    return message.reply("nuked the entire database (history, memory, chat settings)");
  } catch (error) {
    const errId = await logError(error);
    return message.reply(`dev error id: \`${errId}\``);
  }
}

async function handleSlashError(interaction) {
  if (interaction.user.id !== require("../config").OWNER_ID) {
    const embed = new EmbedBuilder().setColor("FF0000").setDescription("You don't have permission to use this command.");
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
  const errorId = interaction.options.getString("id");
  if (!errorId) {
    const embed = new EmbedBuilder().setColor("FF0000").setDescription("Please provide an error ID.");
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
  const log = await getLoggedError(errorId);
  if (!log) {
    const embed = new EmbedBuilder().setColor("FF0000").setDescription("Error ID not found.");
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
  const errorTime = Math.floor(log.time.getTime() / 1000);
  const embed = new EmbedBuilder()
    .setColor("FF0000")
    .setTitle(`Error ID: ${String(errorId).toUpperCase()}`)
    .addFields(
      { name: "Time", value: `<t:${errorTime}:R>`, inline: true },
      { name: "Message", value: log.message, inline: false },
      { name: "Stack Trace", value: `\`\`\`js\n${log.stack.substring(0, 1500)}\n\`\`\``, inline: false },
    );
  return interaction.reply({ embeds: [embed] });
}

async function handleSlashAddPrompt(interaction) {
  if (interaction.user.id !== require("../config").OWNER_ID) return interaction.reply({ content: "nah", ephemeral: true });
  const addition = interaction.options.getString("text");
  if (!addition) return interaction.reply({ content: "add something bro", ephemeral: true });
  await appendToSystemPrompt(addition);
  return interaction.reply("added to system prompt and saved");
}

async function handleSlashClearDb(interaction) {
  if (interaction.user.id !== require("../config").OWNER_ID) return interaction.reply({ content: "nah", ephemeral: true });
  try {
    await ChatHistory.deleteMany({});
    await UserMemory.deleteMany({});
    await ConversationState.deleteMany({});
    return interaction.reply("nuked the entire database (history, memory, chat settings)");
  } catch (error) {
    const errId = await logError(error);
    return interaction.reply({ content: `dev error id: \`${errId}\``, ephemeral: true });
  }
}

module.exports = {
  handleErrorCommand,
  handleAddPromptCommand,
  handleClearDbCommand,
  handleSlashError,
  handleSlashAddPrompt,
  handleSlashClearDb,
};
