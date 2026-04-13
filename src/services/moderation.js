const { UserMemory } = require("../../db");
const { ensureUserMemory } = require("./memory");

async function banUser(targetUserId, moderatorId, reason) {
  const user = await ensureUserMemory(targetUserId);

  user.moderation = {
    banned: true,
    reason,
    bannedAt: new Date(),
    bannedBy: moderatorId,
  };

  await user.save();
  return user;
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

async function getBannedUsers() {
  return UserMemory.find({ "moderation.banned": true }).sort({
    "moderation.bannedAt": -1,
  });
}

module.exports = {
  banUser,
  getBanInfo,
  getBannedUsers,
  unbanUser,
};
