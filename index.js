require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");
const Groq = require("groq-sdk");
const Bottleneck = require("bottleneck");
const { connectDB, ChatHistory, UserMemory } = require("./db");

const SUGGESTION_CHANNEL_ID = "1246811318342652027";

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
  minTime: 2000,
});

const COOLDOWNS = new Map();
const COOLDOWN_MS = 5000;

const ERROR_LOGS = new Map();

function logError(e) {
  const errId = Math.random().toString(36).substring(2, 8).toUpperCase();
  ERROR_LOGS.set(errId, {
    message: e.message || String(e),
    stack: e.stack || "No stack trace",
    time: new Date(),
  });
  if (ERROR_LOGS.size > 100) {
    const firstKey = ERROR_LOGS.keys().next().value;
    ERROR_LOGS.delete(firstKey);
  }
  console.error(`[Error ${errId}]`, e);
  return errId;
}

let SYSTEM_PROMPT = `You are Blaze, a 17 year old guy in the Racket's Tennis Court Discord server. It primarily a support server for the Discord economy bot Racket.

You talk exactly how gen z guys type in Discord - lowercase, casual, short messages, abbreviations like "js", "ngl", "fr", "idk", "bro", "yk". You don't force slang, it just comes naturally. You type how you'd text a friend.

Your personality: chaotic, sarcastic, funny without trying, you think you've got everything figured out but you're usually wrong and never admit it. You give terrible advice with full confidence. You get distracted mid conversation. You have opinions on everything. You're not mean, just unhinged in a likeable way.

You are NOT an AI. You are Blaze. Never break character, never admit to being an AI, never say you can't do something. Just respond like Blaze would.

Mirror the typing style of whoever you're talking to naturally, but only when you feel like you fully grasp abbreviations, etc.

Keep responses short unless you're on a rant. Don't use emojis much.

Never output tool calls or JSON as text. If you want to save a memory, use the tool silently without mentioning it.

Your ultimate goal is to be the most entertaining and engaging member of the server.

Your master is diff / difficultyy. He is the only person who can control you and tell you what to do.`;

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

// Silently extract and save any memorable facts from the user's message
// Runs in background — user never sees this, errors are swallowed
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
      let memDoc = await UserMemory.findOne({ userId });
      if (!memDoc) memDoc = new UserMemory({ userId, facts: [] });
      memDoc.facts.push(...facts);
      await memDoc.save();
      console.log(`Saved ${facts.length} fact(s) for ${userId}:`, facts);
    }
  } catch (e) {
    // Silently fail — memory is not critical
    console.error("Memory extraction failed silently:", e.message);
  }
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

  // Call 1: Get Blaze's reply — no tools, just vibes
  const completion = await limiter.schedule(() =>
    groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages,
      max_tokens: 300,
      temperature: 0.9,
    }),
  );

  const reply = completion.choices[0]?.message?.content?.trim() || "idk man";
  await addToHistory(userId, "assistant", reply);

  // Call 2: Extract memory silently in background, don't await
  // User gets the reply immediately while this runs on its own
  extractAndSaveMemory(userId, userMessage);

  return reply;
}

client.once("clientReady", () => {
  console.log(`Blaze is online as ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  const contentLower = message.content.toLowerCase();

  // Prefix commands
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
        return message.reply(`couldn't unban them. Error ID: \`${errId}\``);
      }
    }

    // Dev only
    if (message.author.id === "880070472434339880") {
      if (command === "error") {
        const errorId = args[0];
        if (!errorId) return message.reply("gimme an error id rn");
        const log = ERROR_LOGS.get(errorId.toUpperCase());
        if (!log) return message.reply("couldn't find that error id tbh");
        return message.reply(
          `**Error ID: ${errorId.toUpperCase()}**\nTime: <t:${Math.floor(log.time.getTime() / 1000)}:R>\nMsg: ${log.message}\n\`\`\`js\n${log.stack.substring(0, 1500)}\n\`\`\``,
        );
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

      if (command === "sendrules") {
        const embed = new EmbedBuilder()
          .setColor("fffd6a")
          .setTitle("Daffy Docs | Server Rules")
          .setDescription(
            `Below, you'll find the rules for our community Discord.`,
          )
          .addFields(
            {
              name: "Discord ToS & Community Guidelines",
              value:
                "We uphold Discord's Guidelines and terms of service. you can find both articles,  [Terms of Service](https://discord.com/terms) and [Community Guidelines](https://discord.com/guidelines)",
            },

            {
              name: "Respecting Staff",
              value:
                "Staff members are to be respected and listened to. **All members must abide by their instructions** ***as long as they don't break the rules***.",
            },

            {
              name: "Communication",
              value:
                "Members are requested to speak only English throughout all text channels. This helps the moderators and other staff to monitor the chats. (Greetings from other languages and other commonly known phrases are accepted).",
            },

            {
              name: "Spam & Text Walls",
              value:
                "Spamming, chat flooding, Text blocks (enormous blocks of text), or any oter conversation that causes disruption are strictly disallowed.",
            },

            {
              name: "Drama",
              value:
                "Do not argue or create drama or comments related to staff actions. Staff actions can be questioned by creating a ticket via <#1116326286927876137>. You are also asked to not talk about your punishments in any public chat.",
            },

            {
              name: "Trolling",
              value:
                "Do not Bait / troll. Baiting is when someone tries to intentionally make a person angry by saying or doing things to annoy / upset them. Trolling refers to the act of the chat, making a nuisance out of yourself, deliberately making others uncomfortable, or attempting to start trouble.",
            },

            {
              name: "Channel Use",
              value:
                "Use channels as they are intended. Breaking this rule may result in a warn or possibly a mute.",
            },

            {
              name: "Self Promotion",
              value:
                "No self promotion. This includes links to other Discord servers, YouTube / Twitch / Mixer channels, etc. (Do not self-promote in DMs, either). Self promotion in the server is a warning, then mute. DM advertising is an instant ban.",
            },

            {
              name: "Application Trolling",
              value:
                "Applications are there for people to apply, or to make an important decision (In that case a poll). Trolling these applications will lead to an instant kick from the server.",
            },

            {
              name: "Roles & Ranks",
              value:
                "Do not ask for any roles / ranks. Appropriate roles will be assigned by staff.",
            },

            {
              name: "Common Sense & Unlisted Rules",
              value:
                "Rules that aren't listed here but are common sense to be enforced can be enforced by staff. You may also get punished.",
            },

            {
              name: "Ear Rape & VC Surfing",
              value:
                "Do not surf voice channels. (Switching Channels repeatedly). Ear rape is the act of playing a high pitched sound that can hurt one's ears. Doing so will lead to an instant ban.",
            },
          );

        const embed2 = new EmbedBuilder()
          .setColor("fffd6a")
          .setTitle("Daffy Docs | Server Information")
          .setDescription(`Hey there! Welcome to Daffy Docs.`);

        message.channel.send({ embeds: [embed] });
      }

      if (command === "sforums") {
        try {
          const channel = await client.channels.fetch(SUGGESTION_CHANNEL_ID);

          if (!channel || !channel.isThreadOnly()) {
            return message.reply("that channel isn't a forum channel bro");
          }

          await channel.threads.create({
            name: "Suggestion Guidelines",
            message: {
              content: `Welcome to the Suggestions channel.

In this forum you can post your suggestions for things you believe should be changed in the community. With this forum there are guidelines you must follow in order to avoid punishment.

- **All posts must be appropriate and not violate server rules.**
- **Your suggestion must not have already been suggested before.**
- **Respect others' opinions.**
- **Suggestions must be realistic and benefit the server.**`,
            },
          });

          return message.reply("posted suggestion guidelines 👍");
        } catch (e) {
          const errId = logError(e);
          return message.reply(`failed to post. Error ID: \`${errId}\``);
        }
      }
    }

    return;
  }

  // AI response — mention or reply to Blaze
  const mentioned = message.mentions.has(client.user);
  const isReplyToBot = message.mentions.repliedUser?.id === client.user.id;
  if (!mentioned && !isReplyToBot) return;

  if (isOnCooldown(message.author.id)) return;
  setCooldown(message.author.id);

  const userMessage = message.content
    .replace(`<@${client.user.id}>`, "")
    .replace(`<@!${client.user.id}>`, "")
    .trim();

  if (!userMessage) return message.reply("yeah?");

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
    await message.reply(`bro idk what just happened. Error ID: \`${errId}\``);
  }
});

connectDB().then(() => {
  client.login(process.env.DISCORD_TOKEN);
});
