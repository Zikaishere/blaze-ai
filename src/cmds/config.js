const { EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const {
  getGuildConfig,
  getUserConfig,
  getEffectiveConfig,
  updateGuildConfig,
  updateUserConfig,
  addGuildPrompt,
  addCustomFact,
  removeCustomFact,
} = require("../services/config");
const { logError } = require("../state/errors");
const { OWNER_ID, DEFAULT_MODEL } = require("../config");

function isGuildAdmin(message) {
  if (message.author.id === OWNER_ID) return true;
  if (!message.guild || !message.member) return false;
  return message.member.permissions.has(PermissionFlagsBits.Administrator);
}

function isGuildAdminInteraction(interaction) {
  if (interaction.user.id === OWNER_ID) return true;
  if (!interaction.guild || !interaction.member) return false;
  return interaction.member.permissions.has(PermissionFlagsBits.Administrator);
}

async function handleConfigViewPrefix(message, args) {
  const sub = (args[0] || "").toLowerCase();

  if (sub === "prefix" && args[1] && isGuildAdmin(message)) {
    await updateGuildConfig(message.guildId, { prefix: args[1] });
    return message.reply(`prefix changed to \`${args[1]}\``);
  }

  if (sub === "model" && args[1] && message.author.id === OWNER_ID) {
    await updateGuildConfig(message.guildId, { model: args[1] });
    return message.reply(`model for this server set to \`${args[1]}\``);
  }

  if (sub === "style" && args[1]) {
    const valid = ["default", "short", "long", "casual", "formal"];
    if (!valid.includes(args[1])) {
      return message.reply(`style must be one of: ${valid.join(", ")}`);
    }
    await updateUserConfig(message.author.id, { style: args[1] });
    return message.reply(`your chat style is now \`${args[1]}\``);
  }

  if (sub === "memory") {
    const enabled = args[1] !== "off";
    await updateUserConfig(message.author.id, { memoryEnabled: enabled });
    return message.reply(`memory is now ${enabled ? "on" : "off"} for you`);
  }

  if (sub === "prompt" && args.slice(1).length && isGuildAdmin(message)) {
    const text = args.slice(1).join(" ");
    await addGuildPrompt(message.guildId, text);
    return message.reply("added server prompt addition");
  }

  if (args[0] === "fact") {
    const action = (args[1] || "").toLowerCase();
    const userCfg = await getUserConfig(message.author.id);

    if (action === "add" && args.slice(2).length) {
      const text = args.slice(2).join(" ");
      await addCustomFact(message.author.id, text);
      return message.reply(`saved: "${text}"`);
    }

    if (action === "remove" || action === "rm") {
      const idx = parseInt(args[2], 10);
      if (isNaN(idx) || idx < 1 || idx > userCfg.customFacts.length) {
        return message.reply("provide a valid fact number (use `b.config fact list` to see them)");
      }
      const removed = userCfg.customFacts[idx - 1];
      await removeCustomFact(message.author.id, idx - 1);
      return message.reply(`removed: "${removed}"`);
    }

    if (action === "list") {
      if (!userCfg.customFacts.length) return message.reply("you haven't saved any facts yet");
      const lines = userCfg.customFacts.map((f, i) => `${i + 1}. ${f}`).join("\n");
      return message.reply(`**Your saved facts:**\n${lines}`);
    }

    return message.reply("usage: `b.config fact add <text>`, `b.config fact list`, or `b.config fact remove <n>`");
  }

  if (args[0] === "view" || args.length === 0) {
    const config = await getEffectiveConfig(message.guildId, message.author.id);
    const userCfg = await getUserConfig(message.author.id);
    const guildCfg = message.guildId ? await getGuildConfig(message.guildId) : null;

    const embed = new EmbedBuilder()
      .setColor(0xff6a00)
      .setTitle("Blaze Config")
      .addFields(
        {
          name: "🌐 Server",
          value:
            `prefix: \`${config.prefix}\`\n` +
            `model: \`${config.model}\`\n` +
            `ai: ${config.aiEnabled ? "on" : "off"}\n` +
            `cooldown: ${config.cooldownMs}ms\n` +
            `max tokens: ${config.maxTokens}\n` +
            `temperature: ${config.temperature}\n` +
            `allowed channels: ${config.allowedChannels.length ? `<#${config.allowedChannels.join(">, <#")}>` : "all"}` +
            (guildCfg?.promptAdditions?.length ? `\nprompt additions: ${guildCfg.promptAdditions.length}` : ""),
          inline: false,
        },
        {
          name: "👤 You",
          value:
            `style: \`${userCfg.style}\`\n` +
            `memory: ${userCfg.memoryEnabled ? "on" : "off"}\n` +
            `custom facts: ${userCfg.customFacts.length}`,
          inline: false,
        },
      )
      .setFooter({ text: "b.config <key> <value> to change settings" });

    if (userCfg.customFacts.length > 0) {
      embed.addFields({
        name: "📝 Your Facts",
        value: userCfg.customFacts.map((f, i) => `${i + 1}. ${f}`).join("\n").slice(0, 1024),
        inline: false,
      });
    }

    return message.reply({ embeds: [embed] });
  }

  if (isGuildAdmin(message)) {
    const p = await require("../services/config").getPrefix(message.guildId);
    const valid = ["prefix", "model", "style", "memory", "prompt", "fact"];
    return message.reply(`usage: \`${p}config <${valid.join("|")}> <value>\``);
  }

  return message.reply("usage: `b.config view`, `b.config style <style>`, `b.config memory on/off`, or `b.config fact add <text>`");
}

async function handleSlashConfig(interaction) {
  const sub = interaction.options.getSubcommand();
  const value = interaction.options.getString("value");

  if (sub === "view") {
    const config = await getEffectiveConfig(interaction.guildId, interaction.user.id);
    const userCfg = await getUserConfig(interaction.user.id);
    const guildCfg = interaction.guildId ? await getGuildConfig(interaction.guildId) : null;

    const embed = new EmbedBuilder()
      .setColor(0xff6a00)
      .setTitle("Blaze Config")
      .addFields(
        {
          name: "🌐 Server",
          value:
            `prefix: \`${config.prefix}\`\n` +
            `model: \`${config.model}\`\n` +
            `ai: ${config.aiEnabled ? "on" : "off"}\n` +
            `cooldown: ${config.cooldownMs}ms\n` +
            `max tokens: ${config.maxTokens}\n` +
            `temperature: ${config.temperature}\n` +
            `allowed channels: ${config.allowedChannels.length ? `<#${config.allowedChannels.join(">, <#")}>` : "all"}` +
            (guildCfg?.promptAdditions?.length ? `\nprompt additions: ${guildCfg.promptAdditions.length}` : ""),
          inline: false,
        },
        {
          name: "👤 You",
          value:
            `style: \`${userCfg.style}\`\n` +
            `memory: ${userCfg.memoryEnabled ? "on" : "off"}\n` +
            `custom facts: ${userCfg.customFacts.length}`,
          inline: false,
        },
      );

    if (userCfg.customFacts.length > 0) {
      embed.addFields({
        name: "📝 Your Facts",
        value: userCfg.customFacts.map((f, i) => `${i + 1}. ${f}`).join("\n").slice(0, 1024),
        inline: false,
      });
    }

    return interaction.reply({ embeds: [embed] });
  }

  if (sub === "prefix") {
    if (!isGuildAdminInteraction(interaction) || !interaction.guildId) {
      return interaction.reply({ content: "only server admins can change the prefix", ephemeral: true });
    }
    if (!value) return interaction.reply({ content: "provide a prefix value", ephemeral: true });
    await updateGuildConfig(interaction.guildId, { prefix: value });
    return interaction.reply(`prefix changed to \`${value}\``);
  }

  if (sub === "model") {
    if (interaction.user.id !== OWNER_ID || !interaction.guildId) {
      return interaction.reply({ content: "only the bot owner can change the model", ephemeral: true });
    }
    if (!value) return interaction.reply({ content: "provide a model name", ephemeral: true });
    await updateGuildConfig(interaction.guildId, { model: value });
    return interaction.reply(`model for this server set to \`${value}\``);
  }

  if (sub === "style") {
    const valid = ["default", "short", "long", "casual", "formal"];
    if (!value || !valid.includes(value)) {
      return interaction.reply({ content: `style must be one of: ${valid.join(", ")}`, ephemeral: true });
    }
    await updateUserConfig(interaction.user.id, { style: value });
    return interaction.reply(`your chat style is now \`${value}\``);
  }

  if (sub === "memory") {
    const enabled = value !== "off";
    await updateUserConfig(interaction.user.id, { memoryEnabled: enabled });
    return interaction.reply(`memory is now ${enabled ? "on" : "off"} for you`);
  }

  return interaction.reply({ content: "unknown subcommand", ephemeral: true });
}

async function handleSlashFact(interaction) {
  const sub = interaction.options.getSubcommand();
  const text = interaction.options.getString("text");
  const userCfg = await getUserConfig(interaction.user.id);

  if (sub === "add") {
    if (!text) return interaction.reply({ content: "provide a fact to save", ephemeral: true });
    await addCustomFact(interaction.user.id, text);
    return interaction.reply(`saved: "${text}"`);
  }

  if (sub === "list") {
    if (!userCfg.customFacts.length) return interaction.reply("you haven't saved any facts yet");
    const lines = userCfg.customFacts.map((f, i) => `${i + 1}. ${f}`).join("\n");
    return interaction.reply(`**Your saved facts:**\n${lines}`);
  }

  if (sub === "remove") {
    const index = interaction.options.getInteger("index");
    if (!index || index < 1 || index > userCfg.customFacts.length) {
      return interaction.reply({ content: "provide a valid fact number (use `/fact list` to see them)", ephemeral: true });
    }
    const removed = userCfg.customFacts[index - 1];
    await removeCustomFact(interaction.user.id, index - 1);
    return interaction.reply(`removed: "${removed}"`);
  }

  return interaction.reply({ content: "unknown subcommand", ephemeral: true });
}

module.exports = {
  handleConfigViewPrefix,
  handleSlashConfig,
  handleSlashFact,
};
