const { SlashCommandBuilder } = require("discord.js");

const slashCommands = [
  new SlashCommandBuilder().setName("help").setDescription("Shows Blaze command information"),
  new SlashCommandBuilder()
    .setName("config")
    .setDescription("View or change bot configuration")
    .addSubcommand((sub) =>
      sub.setName("view").setDescription("View current configuration"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("prefix")
        .setDescription("Change server prefix (admin only)")
        .addStringOption((opt) => opt.setName("value").setDescription("New prefix").setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName("model")
        .setDescription("Change model for this server (owner only)")
        .addStringOption((opt) => opt.setName("value").setDescription("Model name").setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName("style")
        .setDescription("Set your chat style")
        .addStringOption((opt) =>
          opt
            .setName("value")
            .setDescription("Style")
            .setRequired(true)
            .addChoices(
              { name: "Default", value: "default" },
              { name: "Short", value: "short" },
              { name: "Long", value: "long" },
              { name: "Casual", value: "casual" },
              { name: "Formal", value: "formal" },
            ),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("memory")
        .setDescription("Toggle memory for yourself")
        .addStringOption((opt) =>
          opt
            .setName("value")
            .setDescription("on or off")
            .setRequired(true)
            .addChoices(
              { name: "On", value: "on" },
              { name: "Off", value: "off" },
            ),
        ),
    ),
  new SlashCommandBuilder()
    .setName("fact")
    .setDescription("Manage your custom facts")
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Save a fact about yourself")
        .addStringOption((opt) => opt.setName("text").setDescription("The fact").setRequired(true)),
    )
    .addSubcommand((sub) => sub.setName("list").setDescription("List your saved facts"))
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Remove a saved fact")
        .addIntegerOption((opt) => opt.setName("index").setDescription("Fact number from /fact list").setRequired(true)),
    ),
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
