import type { Message } from "discord.js";
import { getPrefix } from "../../services/ConfigService";
import { isBotConversationMessage, stripBotMention } from "../../utils/messageRouting";
import { handleConversation } from "../../conversation/ConversationHandler";
import { handlePrefix, handleMention } from "../../commands/CommandBus";
import { observe } from "../../dna/observer";
import * as telemetry from "../../telemetry/recorder";

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
