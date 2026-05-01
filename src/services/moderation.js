const { UserMemory } = require("../../db");
const { ensureUserMemory } = require("./memory");

async function recordInfraction(targetUserId, moderatorId, type, reason, meta = {}) {
  const user = await ensureUserMemory(targetUserId);
  user.moderation = user.moderation || {};
  user.moderation.infractions = user.moderation.infractions || [];

  const infraction = {
    type,
    reason,
    moderatorId,
    timestamp: new Date(),
    guildId: meta.guildId || null,
    channelId: meta.channelId || null,
  };

  user.moderation.infractions.push(infraction);

  if (type === "ban") {
    user.moderation.banned = true;
    user.moderation.reason = reason;
    user.moderation.bannedAt = infraction.timestamp;
    user.moderation.bannedBy = moderatorId;
  }

  await user.save();
  return user;
}

async function warnUser(targetUserId, moderatorId, reason, meta = {}) {
  return recordInfraction(targetUserId, moderatorId, "warn", reason, meta);
}

async function kickUser(targetUserId, moderatorId, reason, meta = {}) {
  return recordInfraction(targetUserId, moderatorId, "kick", reason, meta);
}

async function banUser(targetUserId, moderatorId, reason, meta = {}) {
  return recordInfraction(targetUserId, moderatorId, "ban", reason, meta);
}

async function unbanUser(targetUserId) {
  const user = await UserMemory.findOne({ userId: targetUserId });

  if (!user) return null;

  user.moderation = user.moderation || {};
  user.moderation.banned = false;
  await user.save();

  return user;
}

async function getBanInfo(targetUserId) {
  return UserMemory.findOne({ userId: targetUserId });
}

async function getInfractionHistory(targetUserId) {
  return UserMemory.findOne({ userId: targetUserId });
}

async function getBannedUsers() {
  return UserMemory.find({ "moderation.banned": true }).sort({
    "moderation.bannedAt": -1,
  });
}

module.exports = {
  banUser,
  getBanInfo,
  getBannedUsers,
  getInfractionHistory,
  kickUser,
  unbanUser,
  warnUser,
};
