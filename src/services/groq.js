const Bottleneck = require("bottleneck");
const Groq = require("groq-sdk");

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const limiter = new Bottleneck({
  maxConcurrent: 1,
  minTime: 2000,
});

async function withRetry(fn, retries = 2) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const isRateLimit = error.status === 429;
      const isServerError = error.status >= 500 && error.status < 600;
      if (!isRateLimit && !isServerError) throw error;
      if (attempt < retries) {
        const delay = isRateLimit ? 5000 * attempt : 2000 * attempt;
        console.error(`Groq API error (attempt ${attempt}/${retries}), retrying in ${delay}ms:`, error.message);
        await new Promise((r) => setTimeout(r, delay));
      } else {
        throw error;
      }
    }
  }
}

module.exports = {
  groq,
  limiter,
  withRetry,
};
