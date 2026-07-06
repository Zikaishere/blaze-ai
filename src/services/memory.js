const { UserMemory } = require("../../db");
const { groq, limiter, withRetry } = require("./groq");
const { DEFAULT_MODEL } = require("../config");

async function getUserMemory(userId) {
  return UserMemory.findOne({ userId });
}

async function ensureUserMemory(userId) {
  let user = await UserMemory.findOne({ userId });
  if (!user) {
    user = new UserMemory({ userId, profile: "", facts: [] });
  }
  return user;
}

async function extractAndSaveMemory(chatContext, userName, userMessage, history) {
  const user = await ensureUserMemory(chatContext.userId);
  user.messageCount = (user.messageCount || 0) + 1;
  const count = user.messageCount;

  if (count % 5 !== 0 && userMessage.length < 30) {
    await user.save();
    return;
  }

  const recentMessages = history.slice(-6).map((m) => `${m.role}: ${m.content}`).join("\n");

  try {
    const update = await limiter.schedule(() =>
      withRetry(() =>
        groq.chat.completions.create({
          model: DEFAULT_MODEL,
          messages: [
            {
              role: "system",
              content: `You are maintaining a memory profile for a user named "${userName}". 
Your job is to update what you know about them based on the conversation.

Current profile: ${user.profile || "nothing known yet"}
Current facts: ${user.facts.length ? user.facts.map((f, i) => `${i + 1}. ${f}`).join("\n") : "none"}

Read the recent conversation and output a JSON update:
{
  "profile": "A short paragraph summarizing who this user is (age, location, interests, personality, etc). Keep it concise.",
  "newFacts": ["fact1", "fact2"],
  "obsoleteFactIndices": [0, 2]
}

Rules:
- Update the profile with anything new you learn. Keep it current — if something changed, reflect it.
- newFacts: only truly useful facts that would help future conversations. NOT ephemeral chat content.
- obsoleteFactIndices: which existing facts (0-indexed) are now outdated or contradicted. Remove them.
- If nothing changed, output {"profile": "same", "newFacts": [], "obsoleteFactIndices": []}
- Only output valid JSON, nothing else.`,
            },
            {
              role: "user",
              content: `Recent conversation:\n${recentMessages}\n\nNew message from ${userName}: "${userMessage}"`,
            },
          ],
          max_tokens: 300,
          temperature: 0.1,
        }),
      ),
    );

    const raw = update.choices[0]?.message?.content?.trim() || "{}";
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : {};
    }

    if (parsed.profile && parsed.profile !== "same") {
      user.profile = parsed.profile;
    }

    if (Array.isArray(parsed.obsoleteFactIndices)) {
      const toRemove = new Set(parsed.obsoleteFactIndices);
      user.facts = user.facts.filter((_, i) => !toRemove.has(i));
    }

    if (Array.isArray(parsed.newFacts) && parsed.newFacts.length > 0) {
      const existing = new Set(user.facts.map((f) => f.toLowerCase().replace(/\s+/g, " ")));
      for (const fact of parsed.newFacts) {
        const key = fact.toLowerCase().replace(/\s+/g, " ");
        if (!existing.has(key)) {
          user.facts.push(fact);
          existing.add(key);
        }
      }
    }

    await user.save();
    if (parsed.profile && parsed.profile !== "same") {
      console.log(`Updated profile for ${chatContext.userId}`);
    }
  } catch (error) {
    await user.save();
    console.error("Memory update failed:", error.message);
  }
}

module.exports = {
  ensureUserMemory,
  extractAndSaveMemory,
  getUserMemory,
};
