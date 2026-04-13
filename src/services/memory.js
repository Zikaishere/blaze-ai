const { UserMemory } = require("../../db");
const { groq, limiter } = require("./groq");

async function getUserMemory(userId) {
  return UserMemory.findOne({ userId });
}

async function ensureUserMemory(userId) {
  let user = await UserMemory.findOne({ userId });

  if (!user) {
    user = new UserMemory({ userId, facts: [] });
  }

  return user;
}

async function extractAndSaveMemory(userId, userMessage) {
  try {
    const memoryCheck = await limiter.schedule(() =>
      groq.chat.completions.create({
        model: "llama-3.1-8b-instant",
        messages: [
          {
            role: "system",
            content:
              'You extract personal facts about a user from their message. Reply with ONLY a JSON array of short strings like ["fact1", "fact2"]. Reply with [] if nothing is worth remembering. No other text, just the array.',
          },
          {
            role: "user",
            content: `User message: "${userMessage}"`,
          },
        ],
        max_tokens: 100,
        temperature: 0.1,
      }),
    );

    const raw = memoryCheck.choices[0]?.message?.content?.trim() || "[]";
    const facts = JSON.parse(raw);

    if (Array.isArray(facts) && facts.length > 0) {
      const memoryDoc = await ensureUserMemory(userId);
      memoryDoc.facts.push(...facts);
      await memoryDoc.save();
      console.log(`Saved ${facts.length} fact(s) for ${userId}:`, facts);
    }
  } catch (error) {
    console.error("Memory extraction failed silently:", error.message);
  }
}

module.exports = {
  ensureUserMemory,
  extractAndSaveMemory,
  getUserMemory,
};
