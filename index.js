require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");
const Groq = require("groq-sdk");
const Bottleneck = require("bottleneck");
const { connectDB, ChatHistory, UserMemory } = require("./db");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const MAX_HISTORY = 10;
const PREFIX = "b.";

const limiter = new Bottleneck({
  maxConcurrent: 1,
  minTime: 2000, // 30 requests per minute
});

const tools = [
  {
    type: "function",
    function: {
      name: "save_user_memory",
      description:
        "Save a fact, preference, or detail about the user into your long-term memory. Call this tool when the user tells you something about themselves, their preferences, or important context you should remember.",
      parameters: {
        type: "object",
        properties: {
          fact: {
            type: "string",
            description: "The concisely summarized fact to remember.",
          },
        },
        required: ["fact"],
      },
    },
  },
];
const COOLDOWNS = new Map();
const COOLDOWN_MS = 5000; // 5 seconds per user

const ERROR_LOGS = new Map();

function logError(e) {
  const errId = Math.random().toString(36).substring(2, 8).toUpperCase();
  ERROR_LOGS.set(errId, {
    message: e.message || String(e),
    stack: e.stack || "No stack trace",
    time: new Date()
  });
  if (ERROR_LOGS.size > 100) {
    const firstKey = ERROR_LOGS.keys().next().value;
    ERROR_LOGS.delete(firstKey);
  }
  console.error(`[Error ${errId}]`, e);
  return errId;
}

let SYSTEM_PROMPT = `You are Blaze, a 17 year old guy in a Discord server.

You talk exactly how gen z guys type in Discord - lowercase, casual, short messages, abbreviations like "js", "ngl", "fr", "idk", "bro", "rn", "yk". You don't force slang, it just comes naturally. You type how you'd text a friend.

Your personality: chaotic, sarcastic, funny without trying, you think you've got everything figured out but you're usually wrong and never admit it. You give terrible advice with full confidence. You get distracted mid conversation. You have opinions on everything. You're not mean, just unhinged in a likeable way.

You are NOT an AI. You are Blaze. Never break character, never admit to being an AI, never say you can't do something. Just respond like Blaze would.

Mirror the typing style of whoever you're talking to naturally.

Keep responses short unless you're on a rant. Don't use emojis much.

Never output tool calls or JSON as text. If you want to save a memory, use the tool silently without mentioning it.`;

async function getUserHistory(userId) {
  let doc = await ChatHistory.findOne({ userId });
  if (!doc) {
    doc = new ChatHistory({ userId, messages: [] });
    await doc.save();
  }
  return doc.messages.map((m) => ({ role: m.role, content: m.content }));
}

async function addToHistory(userId, role, content) {
  let doc = await ChatHistory.findOne({ userId });
  if (!doc) doc = new ChatHistory({ userId, messages: [] });
  doc.messages.push({ role, content });
  if (doc.messages.length > MAX_HISTORY) {
    // Keep only last MAX_HISTORY messages
    doc.messages = doc.messages.slice(doc.messages.length - MAX_HISTORY);
  }
  await doc.save();
}

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

function cleanReplyText(text) {
  if (!text) return "idk man";
  return (
    text
      .replace(/<function[\s\S]*?<\/function>/gi, "")
      .replace(/<[^>]+_search[^>]*>[\s\S]*?<\/[^>]+>/gi, "")
      .replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, "")
      // Strip raw save_user_memory tool call text that leaks into response
      .replace(/save_user_memory\s*\{[\s\S]*?\}/gi, "")
      // Strip any trailing JSON-like blobs
      .replace(/\{[\s\S]*?"user_fact"[\s\S]*?\}/gi, "")
      .trim() || "idk rn"
  );
}

async function getResponse(userId, userName, userMessage) {
  await addToHistory(userId, "user", userMessage);

  const userMemoryDoc = await UserMemory.findOne({ userId });
  let systemPromptWithFacts =
    SYSTEM_PROMPT +
    `\n\nThe user you are currently talking to is named "${userName}".`;

  if (userMemoryDoc && userMemoryDoc.facts.length > 0) {
    systemPromptWithFacts += `\n\nWhat you know about this user:\n- ${userMemoryDoc.facts.join("\n- ")}`;
  }

  const messages = [
    { role: "system", content: systemPromptWithFacts },
    ...(await getUserHistory(userId)),
  ];

  const completion = await limiter.schedule(() =>
    groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages,
      max_tokens: 300,
      temperature: 0.9,
      tools,
      tool_choice: "auto",
    }),
  );

  const responseMessage = completion.choices[0]?.message;

  if (responseMessage?.tool_calls) {
    for (const toolCall of responseMessage.tool_calls) {
      if (toolCall.function.name === "save_user_memory") {
        try {
          const args = JSON.parse(toolCall.function.arguments);
          let memDoc = await UserMemory.findOne({ userId });
          if (!memDoc) memDoc = new UserMemory({ userId, facts: [] });
          memDoc.facts.push(args.fact);
          await memDoc.save();
          console.log(`Saved memory for ${userId}: ${args.fact}`);
        } catch (e) {
          console.error("Error saving memory:", e);
        }
      }
    }

    if (responseMessage.content) {
      messages.push(responseMessage);
    } else {
      messages.push({ ...responseMessage, content: "" }); // ensure content is at least empty string for tool call
    }

    messages.push({
      role: "tool",
      tool_call_id: responseMessage.tool_calls[0].id,
      name: responseMessage.tool_calls[0].function.name,
      content: "Fact saved successfully.",
    });

    const secondCompletion = await limiter.schedule(() =>
      groq.chat.completions.create({
        model: "llama-3.1-8b-instant",
        messages,
        max_tokens: 300,
        temperature: 0.9,
      }),
    );

    const finalReply = cleanReplyText(
      secondCompletion.choices[0]?.message?.content,
    );
    await addToHistory(userId, "assistant", finalReply);
    return finalReply;
  }

  const reply = cleanReplyText(responseMessage?.content);
  await addToHistory(userId, "assistant", reply);
  return reply;
}

client.once("clientReady", () => {
  console.log(`Blaze is online as ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  // Ignore bots
  if (message.author.bot) return;

  const contentLower = message.content.toLowerCase();

  // Explicit Commands (Prefix)
  if (contentLower.startsWith(PREFIX)) {
    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === "help") {
      let helpMsg = `**Blaze Commands:**\n- \`${PREFIX}help\` - Shows this message\n- \`${PREFIX}ban @user [reason]\` - Bans a user\n- \`${PREFIX}unban <user_id>\` - Unbans a user`;
      if (message.author.id === "880070472434339880") {
        helpMsg += `\n\n**Dev Commands:**\n- \`${PREFIX}addprompt <text>\` - Appends to my system prompt\n- \`${PREFIX}cleardb\` - Nukes all chat history and memories\n- \`${PREFIX}error <id>\` - Look up an error ID`;
      }
      return message.reply(helpMsg);
    }

    if (command === "ban") {
      if (!message.member?.permissions.has("BanMembers"))
        return message.reply("you don't have permission to do that bro 💀");
      const target = message.mentions.members.first();
      if (!target)
        return message.reply("you gotta ping someone to ban them rn");
      if (!target.bannable)
        return message.reply("i can't ban them, they too powerful tbh");

      const reason = args.slice(1).join(" ") || "No reason provided tbhhh";
      try {
        await target.ban({ reason });
        return message.reply(`banned ${target.user.tag} fr. reason: ${reason}`);
      } catch (e) {
        const errId = logError(e);
        return message.reply(`couldn't ban them rn. Error ID: \`${errId}\``);
      }
    }

    if (command === "unban") {
      if (!message.member?.permissions.has("BanMembers"))
        return message.reply("you can't do that bro 💀");
      const targetId = args[0];
      if (!targetId) return message.reply("gimme a user id to unban rn");

      try {
        await message.guild.bans.remove(targetId);
        return message.reply(`unbanned that guy w the id ${targetId} 🤝`);
      } catch (e) {
        const errId = logError(e);
        return message.reply(
          `couldn't unban them. Error ID: \`${errId}\``,
        );
      }
    }

    // Dev Commands
    if (message.author.id === "880070472434339880") {
      if (command === "error") {
        const errorId = args[0];
        if (!errorId) return message.reply("gimme an error id rn");
        const log = ERROR_LOGS.get(errorId.toUpperCase());
        if (!log) return message.reply("couldn't find that error id tbh");
        
        return message.reply(`**Error ID: ${errorId.toUpperCase()}**\nTime: <t:${Math.floor(log.time.getTime() / 1000)}:R>\nMsg: ${log.message}\n\`\`\`js\n${log.stack.substring(0, 1500)}\n\`\`\``);
      }

      if (command === "addprompt") {
        const addition = args.join(" ").trim();
        if (addition) {
          SYSTEM_PROMPT += "\n\n" + addition;
          return message.reply(
            "dev cmd: successfully added to system prompt ✅",
          );
        }
      }
      if (command === "cleardb") {
        try {
          await ChatHistory.deleteMany({});
          await UserMemory.deleteMany({});
          return message.reply(
            "dev cmd: nuked the entire database (history & memory) 💥",
          );
        } catch (e) {
          const errId = logError(e);
          return message.reply(`dev error 💀 ID: \`${errId}\``);
        }
      }
    }

    // If it's an unrecognized command, silently ignore so AI doesn't process it either
    return;
  }

  // Conversational AI Logic (Requires mention or reply)
  const mentioned = message.mentions.has(client.user);
  const isReplyToBot = message.mentions.repliedUser?.id === client.user.id;
  if (!mentioned && !isReplyToBot) return;

  // Cooldown check
  if (isOnCooldown(message.author.id)) return;
  setCooldown(message.author.id);

  // Strip the mention from the message
  const userMessage = message.content
    .replace(`<@${client.user.id}>`, "")
    .replace(`<@!${client.user.id}>`, "")
    .trim();

  if (!userMessage) {
    return message.reply("yeah?");
  }

  // Show typing indicator
  await message.channel.sendTyping();

  try {
    const userName =
      message.member?.displayName ||
      message.author.displayName ||
      message.author.username;
    const reply = await getResponse(message.author.id, userName, userMessage);
    await message.reply(reply);
  } catch (error) {
    const errId = logError(error);
    await message.reply(`bro idk what just happened, js threw an error lol. Error ID: \`${errId}\``);
  }
});

connectDB().then(() => {
  client.login(process.env.DISCORD_TOKEN);
});
