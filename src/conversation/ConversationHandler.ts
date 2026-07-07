import type { Message } from "discord.js";
import { getEffectiveConfig } from "../services/ConfigService.js";
import { addToChatHistory, getChatHistory } from "../services/ConversationService.js";
import { getProvider } from "../ai/factory.js";
import { engine } from "../personality/PersonalityEngine.js";
import { buildContext } from "./ContextBuilder.js";
import { checkCooldown, setCooldown } from "./CooldownGuard.js";
import { parseFlags } from "./InlineFlagParser.js";
import { tryAbilities } from "../abilities/AbilityRegistry.js";
import { env } from "../config/index.js";
import { getDNA } from "../dna/observer.js";
import { getProfile, updateProfile } from "../user-profiles/ProfileEngine.js";
import { memoryManager } from "../memory/MemoryManager.js";

async function getServerDNAData(guildId: string | null) {
  if (!guildId) return null;
  try {
    const doc = await getDNA(guildId);
    if (!doc || !doc.isReady) return null;
    return {
      traits: doc.traits,
      confidence: doc.messageCount || 0,
      topSlang: doc.topSlang || [],
    };
  } catch {
    return null;
  }
}

export async function handleConversation(message: Message): Promise<boolean> {
  const context = buildContext(message);
  const config = await getEffectiveConfig(context.guildId, context.userId);

  if (!config.aiEnabled) return false;

  if (checkCooldown(context.userId, config.cooldownMs)) return true;
  setCooldown(context.userId, config.cooldownMs);

  const { clean: userMessage, overrides } = parseFlags(
    message.content,
    context.userId,
    env.ownerId,
    message.guild,
    message.member,
  );

  if (!userMessage) {
    await message.reply("yeah?");
    return true;
  }

  Object.assign(config, overrides);

  let typingInterval: ReturnType<typeof setInterval> | null = null;

  try {
    const abilityResult = await tryAbilities(userMessage, context.guildId);
    if (abilityResult) {
      await addToChatHistory(context, "user", userMessage);
      await addToChatHistory(context, "assistant", abilityResult);
      await message.reply(abilityResult);
      return true;
    }

    await addToChatHistory(context, "user", userMessage);

    typingInterval = setInterval(
      () => (message.channel as any).sendTyping().catch(() => {}),
      8000,
    );

    const guildMemories = await memoryManager
      .getRelevant("guild", context.guildId || "global", 5)
      .catch(() => []);

    const [history, userProfile, serverDNA] = await Promise.all([
      getChatHistory(context.chatKey),
      config.memoryEnabled ? getProfile(context.userId) : null,
      getServerDNAData(context.guildId),
    ]);

    const userName =
      message.member?.displayName ||
      message.author.globalName ||
      message.author.username;

    const systemPrompt = engine.build({
      userName,
      style: config.style,
      additions: [],
      guildAdditions: config.guildPromptAdditions,
      guildMemories: config.memoryEnabled ? guildMemories : undefined,
      dna: serverDNA,
      userProfile: userProfile?.profile,
      facts: userProfile?.facts,
      interests: userProfile?.interests,
      customFacts: config.customFacts,
      memoryEnabled: config.memoryEnabled,
      abilityNames: [],
    });

    const provider = getProvider();
    const response = await provider.generateChat({
      systemPrompt,
      messages: [...history, { role: "user", content: userMessage }],
      model: config.model,
      maxTokens: config.maxTokens,
      temperature: config.temperature,
    });

    if (typingInterval) clearInterval(typingInterval);
    await addToChatHistory(context, "assistant", response.content);
    await message.reply(response.content);

    if (config.memoryEnabled) {
      updateProfile(context.userId, userName, userMessage, history);
    }
    return true;
  } catch (error) {
    if (typingInterval) clearInterval(typingInterval);
    console.error("Conversation handler error:", error);
    await message.reply("bro idk what just happened");
    return true;
  }
}
