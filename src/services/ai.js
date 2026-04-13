const { BASE_SYSTEM_PROMPT, DEFAULT_MODEL, DEV_MODEL } = require("../config");
const { addToChatHistory, getChatHistory } = require("./chatHistory");
const { getConversationState } = require("./conversationState");
const { groq, limiter } = require("./groq");
const { extractAndSaveMemory, getUserMemory } = require("./memory");

let systemPrompt = BASE_SYSTEM_PROMPT;

function appendToSystemPrompt(addition) {
  systemPrompt += `\n\n${addition}`;
}

function buildSystemPrompt(userName, userMemory, devMode) {
  let prompt =
    systemPrompt +
    `\n\nThe user you are currently talking to is named "${userName}".`;

  if (userMemory?.facts?.length) {
    prompt += `\n\nWhat you know about this user:\n- ${userMemory.facts.join("\n- ")}`;
  }

  if (devMode) {
    prompt +=
      "\n\nYou are in dev mode for this chat only. Keep the same Blaze personality, but be more precise, more capable in technical conversations, and better at sustained back-and-forth problem solving.";
  }

  return prompt;
}

async function getResponse(chatContext, userName, userMessage) {
  await addToChatHistory(chatContext, "user", userMessage);

  const [userMemory, conversationState, history] = await Promise.all([
    getUserMemory(chatContext.userId),
    getConversationState(chatContext),
    getChatHistory(chatContext.chatKey),
  ]);

  const messages = [
    {
      role: "system",
      content: buildSystemPrompt(userName, userMemory, conversationState.devMode),
    },
    ...history,
  ];

  const completion = await limiter.schedule(() =>
    groq.chat.completions.create({
      model: conversationState.devMode ? DEV_MODEL : DEFAULT_MODEL,
      messages,
      max_tokens: 300,
      temperature: 0.9,
    }),
  );

  const reply = completion.choices[0]?.message?.content?.trim() || "idk man";
  await addToChatHistory(chatContext, "assistant", reply);

  extractAndSaveMemory(chatContext.userId, userMessage);

  return {
    devMode: conversationState.devMode,
    reply,
  };
}

module.exports = {
  appendToSystemPrompt,
  getResponse,
};
