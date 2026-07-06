const DEFAULT_COOLDOWN = 3000;
const COOLDOWNS = new Map();

function isOnCooldown(userId, cooldownMs) {
  const effective = cooldownMs || DEFAULT_COOLDOWN;
  if (!COOLDOWNS.has(userId)) return false;

  const expires = COOLDOWNS.get(userId);
  if (Date.now() < expires) return true;

  COOLDOWNS.delete(userId);
  return false;
}

function setCooldown(userId, cooldownMs) {
  const effective = cooldownMs || DEFAULT_COOLDOWN;
  COOLDOWNS.set(userId, Date.now() + effective);
}

module.exports = {
  isOnCooldown,
  setCooldown,
};
