const { COOLDOWN_MS } = require("../config");

const COOLDOWNS = new Map();

function isOnCooldown(userId) {
  if (!COOLDOWNS.has(userId)) return false;

  const expires = COOLDOWNS.get(userId);
  if (Date.now() < expires) return true;

  COOLDOWNS.delete(userId);
  return false;
}

function setCooldown(userId) {
  COOLDOWNS.set(userId, Date.now() + COOLDOWN_MS);
}

module.exports = {
  isOnCooldown,
  setCooldown,
};
