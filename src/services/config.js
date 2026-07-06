const GuildConfig = require("../models/GuildConfig");
const UserConfig = require("../models/UserConfig");
const { PREFIX, DEFAULT_MODEL, COOLDOWN_MS } = require("../config");

const guildCache = new Map();
const CACHE_TTL = 60_000;

async function getGuildConfig(guildId) {
  if (!guildId) return null;

  const cached = guildCache.get(guildId);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.data;
  }

  let config = await GuildConfig.findOne({ guildId });
  if (!config) {
    config = await GuildConfig.create({ guildId });
  }

  guildCache.set(guildId, { data: config, ts: Date.now() });
  return config;
}

async function getUserConfig(userId) {
  let config = await UserConfig.findOne({ userId });
  if (!config) {
    config = await UserConfig.create({ userId });
  }
  return config;
}

async function getPrefix(guildId) {
  if (!guildId) return PREFIX;
  const guild = await getGuildConfig(guildId);
  return guild.prefix || PREFIX;
}

async function getEffectiveConfig(guildId, userId) {
  const [guildCfg, userCfg] = await Promise.all([
    getGuildConfig(guildId),
    getUserConfig(userId),
  ]);

  return {
    prefix: guildCfg.prefix || PREFIX,
    model: guildCfg.model || DEFAULT_MODEL,
    maxTokens: guildCfg.maxTokens || 500,
    temperature: guildCfg.temperature ?? 0.9,
    cooldownMs: guildCfg.cooldownMs || COOLDOWN_MS,
    aiEnabled: guildCfg.aiEnabled !== false,
    allowedChannels: guildCfg.allowedChannels || [],
    guildPromptAdditions: guildCfg.promptAdditions || [],
    style: userCfg.style || "default",
    memoryEnabled: userCfg.memoryEnabled !== false,
    customFacts: userCfg.customFacts || [],
  };
}

async function updateGuildConfig(guildId, updates) {
  const config = await GuildConfig.findOneAndUpdate(
    { guildId },
    { $set: updates },
    { upsert: true, new: true },
  );
  guildCache.set(guildId, { data: config, ts: Date.now() });
  return config;
}

async function updateUserConfig(userId, updates) {
  return UserConfig.findOneAndUpdate(
    { userId },
    { $set: updates },
    { upsert: true, new: true },
  );
}

async function addGuildPrompt(guildId, text) {
  const config = await getGuildConfig(guildId);
  config.promptAdditions.push(text);
  await config.save();
  guildCache.set(guildId, { data: config, ts: Date.now() });
}

async function addCustomFact(userId, text) {
  const config = await getUserConfig(userId);
  config.customFacts.push(text);
  await config.save();
}

async function removeCustomFact(userId, index) {
  const config = await getUserConfig(userId);
  if (index >= 0 && index < config.customFacts.length) {
    config.customFacts.splice(index, 1);
    await config.save();
  }
}

function invalidateGuildCache(guildId) {
  guildCache.delete(guildId);
}

module.exports = {
  getGuildConfig,
  getUserConfig,
  getPrefix,
  getEffectiveConfig,
  updateGuildConfig,
  updateUserConfig,
  addGuildPrompt,
  addCustomFact,
  removeCustomFact,
  invalidateGuildCache,
};
