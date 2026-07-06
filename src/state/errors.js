const ErrorLog = require("../models/ErrorLog");

const CACHE = new Map();
const MAX_CACHE = 100;

async function logError(error) {
  const errId = Math.random().toString(36).substring(2, 8).toUpperCase();
  const entry = {
    message: error.message || String(error),
    stack: error.stack || "No stack trace",
    time: new Date(),
  };

  CACHE.set(errId, entry);
  if (CACHE.size > MAX_CACHE) {
    const firstKey = CACHE.keys().next().value;
    CACHE.delete(firstKey);
  }

  console.error(`[Error ${errId}]`, error);

  try {
    await ErrorLog.create({ errId, ...entry });
  } catch {
    // DB write failure is non-fatal
  }

  return errId;
}

async function getLoggedError(errorId) {
  const id = String(errorId || "").toUpperCase();
  if (CACHE.has(id)) return CACHE.get(id);

  try {
    const doc = await ErrorLog.findOne({ errId: id }).lean();
    if (doc) {
      const entry = { message: doc.message, stack: doc.stack, time: doc.time };
      CACHE.set(id, entry);
      return entry;
    }
  } catch {
    // DB read failure — fall through
  }

  return null;
}

module.exports = {
  getLoggedError,
  logError,
};
