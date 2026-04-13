const ERROR_LOGS = new Map();

function logError(error) {
  const errId = Math.random().toString(36).substring(2, 8).toUpperCase();

  ERROR_LOGS.set(errId, {
    message: error.message || String(error),
    stack: error.stack || "No stack trace",
    time: new Date(),
  });

  if (ERROR_LOGS.size > 100) {
    const firstKey = ERROR_LOGS.keys().next().value;
    ERROR_LOGS.delete(firstKey);
  }

  console.error(`[Error ${errId}]`, error);
  return errId;
}

function getLoggedError(errorId) {
  return ERROR_LOGS.get(String(errorId || "").toUpperCase());
}

module.exports = {
  getLoggedError,
  logError,
};
