const Bottleneck = require("bottleneck");
const Groq = require("groq-sdk");

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const limiter = new Bottleneck({
  maxConcurrent: 1,
  minTime: 2000,
});

module.exports = {
  groq,
  limiter,
};
