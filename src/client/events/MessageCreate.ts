import type { Message } from "discord.js";
import { getPrefix } from "../../services/ConfigService.js";
import { isBotConversationMessage, stripBotMention } from "../../utils/messageRouting.js";
import { handleConversation } from "../../conversation/ConversationHandler.js";
import { handlePrefix, handleMention } from "../../commands/CommandBus.js";
import { observe } from "../../dna/observer.js";
import * as telemetry from "../../telemetry/recorder.js";

export async function handleMessage(message: Message): Promise<void> {
  try {
    if (message.author.bot) return;

    observe(message);

    telemetry.addActiveUser(message.author.id);

    const isDirectMessage =
      message.channel?.isDMBased?.() ??
      (typeof message.inGuild === "function"
        ? !message.inGuild()
        : !message.guildId && !message.guild);

    if (isDirectMessage) {
      console.log(`DM from ${message.author.tag} (${message.author.id})`);
    }

    const prefix = await getPrefix(message.guildId);
    const contentLower = message.content.toLowerCase();

    if (contentLower.startsWith(prefix.toLowerCase())) {
      telemetry.recordMessage();
      await handlePrefix(message);
      return;
    }

    const routing = isBotConversationMessage(message, message.client.user!.id);
    if (!routing.shouldHandle) return;

    const mentionText = stripBotMention(message.content, message.client.user!.id);

    const handled = await handleMention(message, mentionText);
    if (handled) {
      telemetry.recordCommand("mention");
      return;
    }

    telemetry.recordMessage();

    await handleConversation(message);
  } catch (error) {
    console.error("Unhandled error in message handler:", error);
  }
}
