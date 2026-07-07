import { EmbedBuilder } from "discord.js";
import { BaseCommand } from "../base/BaseCommand";
import type { CommandContext } from "../types";
import { env } from "../../config";
import { getPrefix } from "../../services/ConfigService";

export class HelpCommand extends BaseCommand {
  name = "help";
  description = "Shows Charlie command information";

  async run(ctx: CommandContext) {
    const prefix = ctx.type === "slash" ? "/" : await getPrefix(ctx.guildId);
    const isMod = await this.isModerator(ctx);
    const isOwner = ctx.userId === env.ownerId;

    const embed = new EmbedBuilder()
      .setColor(0xff6a00)
      .setTitle("Charlie Commands")
      .setDescription("chaotic ai energy, now in your server")
      .addFields({
        name: "💬 Chat",
        value:
          `- \`${prefix}help\` — this message\n` +
          `- \`${prefix}config\` — view/change settings\n` +
          `- \`${prefix}config style <style>\` — set your chat style\n` +
          `- \`${prefix}config memory on/off\` — toggle memory for yourself\n` +
          `- \`${prefix}fact add <text>\` — save a fact about yourself\n` +
          `- Ping me or reply to talk\n` +
          `- DM me to chat privately`,
        inline: false,
      });

    if (isMod) {
      embed.addFields({
        name: "🛡️ Moderation",
        value:
          `- \`${prefix}warn @user [reason]\` — warn a user\n` +
          `- \`${prefix}kick @user [reason]\` — kick + record infraction\n` +
          `- \`${prefix}ban @user [reason]\` — ban + record infraction\n` +
          `- \`${prefix}unban @user\` — unban a user\n` +
          `- \`${prefix}history @user\` — view infractions\n` +
          `- \`${prefix}banlist\` — list all banned users\n` +
          `- Mention me directly too: \`@Charlie warn @user [reason]\``,
        inline: false,
      });
    }

    if (isOwner) {
      embed.addFields({
        name: "⚙️ Owner",
        value:
          `- \`${prefix}config model <name>\` — change model\n` +
          `- \`${prefix}config prompt <text>\` — add server prompt addition\n` +
          `- \`${prefix}addprompt <text>\` — append to global system prompt\n` +
          `- \`${prefix}cleardb\` — wipe all history & memories\n` +
          `- \`${prefix}error <id>\` — look up an error by ID` +
          `- \`${prefix}stats [type]\` — bot telemetry charts`,
        inline: false,
      });
    }

    embed.setFooter({ text: "charlie ai • meridian systems" });

    return { embeds: [embed] };
  }

  private async isModerator(ctx: CommandContext): Promise<boolean> {
    if (ctx.userId === env.ownerId) return true;
    if (!ctx.guildId) return false;

    if (ctx.type === "slash" && ctx.interaction?.member) {
      const perms = (ctx.interaction.member as any).permissions;
      if (perms && typeof perms.has === "function") {
        return perms.has(1n << 2n) || perms.has(1n << 3n);
      }
    }

    if (ctx.type === "prefix" || ctx.type === "mention") {
      if (ctx.message.member && "permissions" in ctx.message.member) {
        const perms = (ctx.message.member as any).permissions;
        if (perms && typeof perms.has === "function") {
          return perms.has(1n << 2n) || perms.has(1n << 3n);
        }
      }
    }

    return false;
  }
}
