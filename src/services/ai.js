const SystemPrompt = require("../models/SystemPrompt");
const { BASE_SYSTEM_PROMPT } = require("../config");
const { addToChatHistory, getChatHistory } = require("./chatHistory");
const { groq, limiter, withRetry } = require("./groq");
const { extractAndSaveMemory, getUserMemory } = require("./memory");

let additions = [];

async function loadSystemPrompt() {
  try {
    const doc = await SystemPrompt.findOne({ key: "additions" });
    if (doc && doc.additions.length > 0) {
      additions = doc.additions;
      console.log(`Loaded ${additions.length} system prompt addition(s)`);
    }
  } catch (error) {
    console.error("Failed to load system prompt additions:", error.message);
  }
}

async function appendToSystemPrompt(addition) {
  additions.push(addition);
  try {
    await SystemPrompt.findOneAndUpdate(
      { key: "additions" },
      { $push: { additions: addition } },
      { upsert: true },
    );
  } catch (error) {
    console.error("Failed to persist system prompt addition:", error.message);
  }
}

const STYLE_HINTS = {
  short: "\nKeep responses very short and concise.",
  long: "\nFeel free to give detailed, thorough responses.",
  casual: "\nBe extra casual and chill in your tone.",
  formal: "\nBe more formal and proper in your tone.",
};

function buildSystemPrompt(userName, userMemory, config) {
  let prompt = BASE_SYSTEM_PROMPT +
    `\n\nThe user you are currently talking to is named "${userName}".`;

  if (userMemory?.profile) {
    prompt += `\n\nWhat you remember about this user:\n${userMemory.profile}`;
  }

  if (userMemory?.facts?.length) {
    const uniqueFacts = [...new Set(userMemory.facts)];
    prompt += `\n\nKey facts:\n- ${uniqueFacts.join("\n- ")}`;
  }

  const style = config?.style || "default";
  if (style !== "default" && STYLE_HINTS[style]) {
    prompt += STYLE_HINTS[style];
  }

  if (config?.customFacts?.length) {
    prompt += `\n\nFacts ${userName} shared about themself:\n- ${config.customFacts.join("\n- ")}`;
  }

  if (config?.guildPromptAdditions?.length) {
    prompt += `\n\nServer-specific context:\n${config.guildPromptAdditions.join("\n")}`;
  }

  if (additions.length > 0) {
    prompt += `\n\nAdditional context:\n${additions.join("\n")}`;
  }

  return prompt;
}

async function getResponse(chatContext, userName, userMessage, config) {
  await addToChatHistory(chatContext, "user", userMessage);

  const [userMemory, history] = await Promise.all([
    getUserMemory(chatContext.userId),
    getChatHistory(chatContext.chatKey),
  ]);

  const messages = [
    {
      role: "system",
      content: buildSystemPrompt(userName, userMemory, config),
    },
    ...history,
  ];

  const effectiveModel = config?.model || "llama-3.3-70b-versatile";
  const effectiveMaxTokens = config?.maxTokens || 500;
  const effectiveTemperature = config?.temperature ?? 0.9;

  const completion = await limiter.schedule(() =>
    withRetry(() =>
      groq.chat.completions.create({
        model: effectiveModel,
        messages,
        max_tokens: effectiveMaxTokens,
        temperature: effectiveTemperature,
      }),
    ),
  );

  const reply = completion.choices[0]?.message?.content?.trim() || "idk man";
  await addToChatHistory(chatContext, "assistant", reply);

  if (config?.memoryEnabled !== false) {
    extractAndSaveMemory(chatContext, userName, userMessage, history);
  }

  return { reply };
}

module.exports = {
  appendToSystemPrompt,
  getResponse,
  loadSystemPrompt,
};
