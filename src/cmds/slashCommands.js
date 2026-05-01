const { SlashCommandBuilder } = require("discord.js");

const slashCommands = [
  new SlashCommandBuilder().setName("help").setDescription("Shows Blaze command information"),
  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warns a user")
    .addUserOption((option) => option.setName("target").setDescription("User to warn").setRequired(true))
    .addStringOption((option) => option.setName("reason").setDescription("Reason for the warning").setRequired(false)),
  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kicks a user and records the infraction")
    .addUserOption((option) => option.setName("target").setDescription("User to kick").setRequired(true))
    .addStringOption((option) => option.setName("reason").setDescription("Reason for the kick").setRequired(false)),
  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Bans a user and records the infraction")
    .addUserOption((option) => option.setName("target").setDescription("User to ban").setRequired(true))
    .addStringOption((option) => option.setName("reason").setDescription("Reason for the ban").setRequired(false)),
  new SlashCommandBuilder()
    .setName("unban")
    .setDescription("Unbans a user")
    .addUserOption((option) => option.setName("target").setDescription("User to unban").setRequired(true)),
  new SlashCommandBuilder()
    .setName("history")
    .setDescription("Shows a user's infraction history")
    .addUserOption((option) => option.setName("target").setDescription("User to inspect").setRequired(true)),
  new SlashCommandBuilder()
    .setName("baninfo")
    .setDescription("Shows ban info for a user")
    .addUserOption((option) => option.setName("target").setDescription("User to inspect").setRequired(true)),
  new SlashCommandBuilder().setName("banlist").setDescription("Lists recorded ban infractions"),
  new SlashCommandBuilder()
    .setName("devmode")
    .setDescription("Toggle dev mode for this chat")
    .addStringOption((option) =>
      option
        .setName("mode")
        .setDescription("on or off")
        .addChoices({ name: "on", value: "on" }, { name: "off", value: "off" })
        .setRequired(false),
    ),
  new SlashCommandBuilder()
    .setName("sendrules")
    .setDescription("Posts the server rules embed"),
  new SlashCommandBuilder()
    .setName("sforums")
    .setDescription("Posts suggestion forum guidelines"),
  new SlashCommandBuilder()
    .setName("error")
    .setDescription("Look up an error ID")
    .addStringOption((option) => option.setName("id").setDescription("Error ID").setRequired(true)),
  new SlashCommandBuilder()
    .setName("addprompt")
    .setDescription("Appends text to the system prompt")
    .addStringOption((option) => option.setName("text").setDescription("Text to append").setRequired(true)),
  new SlashCommandBuilder().setName("cleardb").setDescription("Nukes all chat history and memories"),
];

module.exports = {
  slashCommands: slashCommands.map((command) => command.toJSON()),
};
