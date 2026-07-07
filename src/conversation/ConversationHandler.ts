import type { Message } from "discord.js";
import { getEffectiveConfig } from "../services/ConfigService";
import { addToChatHistory, getChatHistory } from "../services/ConversationService";
import { getProvider } from "../ai/factory";
import { engine } from "../personality/PersonalityEngine";
import { buildContext } from "./ContextBuilder";
import { checkCooldown, setCooldown } from "./CooldownGuard";
import { parseFlags } from "./InlineFlagParser";
import { tryAbilities } from "../abilities/AbilityRegistry";
import { env } from "../config";
import { getDNA } from "../dna/observer";
import { getProfile, updateProfile } from "../user-profiles/ProfileEngine";
import { memoryManager } from "../memory/MemoryManager";

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

  try {
    const abilityResult = await tryAbilities(userMessage, context.guildId);
    if (abilityResult) {
      await addToChatHistory(context, "user", userMessage);
      await addToChatHistory(context, "assistant", abilityResult);
      await message.reply(abilityResult);
      return true;
    }

    await addToChatHistory(context, "user", userMessage);

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

    await addToChatHistory(context, "assistant", response.content);
    await message.reply(response.content);

    if (config.memoryEnabled) {
      updateProfile(context.userId, userName, userMessage, history);
    }
    return true;
  } catch (error) {
    console.error("Conversation handler error:", error);
    await message.reply("bro idk what just happened");
    return true;
  }
}
