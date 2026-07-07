import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { BaseCommand } from "../base/BaseCommand.js";
import type { CommandContext } from "../types.js";
import { env } from "../../config/index.js";

async function ensureUserMemory(userId: string) {
  const UserMemory = (await import("../../models/UserMemory")).default;
  let doc = await UserMemory.findOne({ userId });
  if (!doc) {
    doc = new UserMemory({ userId, profile: "", facts: [], moderation: { banned: false, reason: null, bannedAt: null, bannedBy: null, infractions: [] } });
    await doc.save();
  }
  return doc;
}

async function resolveTarget(ctx: CommandContext) {
  if (ctx.type === "slash" && ctx.interaction) {
    const target = ctx.interaction.options.getUser("target");
    const reason = ctx.interaction.options.getString("reason") || "no reason";
    return { target, reason };
  }

  const mention = ctx.message.mentions.users.first();
  const target = mention || (ctx.args[0] ? await ctx.message.client.users.fetch(ctx.args[0]).catch(() => null) : null);
  let reason = ctx.args.slice(1).join(" ").trim();
  reason = reason.replace(/^(for|because)\s+/i, "").trim() || "no reason";
  return { target, reason };
}

async function sendDM(target: any, type: string, reason: string, moderator: any, guildName?: string) {
  const text = `You received a ${type} from Charlie${guildName ? ` in ${guildName}` : ""}.\nReason: ${reason}\nModerator: ${moderator.tag}`;
  try {
    const dm = await target.createDM();
    await dm.send(text);
  } catch { /* DM may be closed */ }
}

export class ModerationCommand extends BaseCommand {
  name = "moderation";
  description = "Moderation commands";
  aliases = ["warn", "kick", "ban", "unban", "history", "baninfo", "banlist"];

  async run(ctx: CommandContext) {
    const cmd = ctx.name === "moderation" ? ctx.args[0]?.toLowerCase() || "" : ctx.name;

    if (cmd === "warn") return this.warn(ctx);
    if (cmd === "kick") return this.kick(ctx);
    if (cmd === "ban") return this.ban(ctx);
    if (cmd === "unban") return this.unban(ctx);
    if (cmd === "history" || cmd === "infractionhistory") return this.history(ctx);
    if (cmd === "baninfo") return this.banInfo(ctx);
    if (cmd === "banlist") return this.banList(ctx);

    return null;
  }

  private async warn(ctx: CommandContext) {
    if (!await this.isMod(ctx)) return "nah";
    const { target, reason } = await resolveTarget(ctx);
    if (!target) return "ping someone";

    const user = await ensureUserMemory(target.id);
    user.moderation.infractions.push({
      type: "warn" as const,
      reason,
      moderatorId: ctx.userId,
      timestamp: new Date(),
      guildId: ctx.guildId,
      channelId: ctx.channelId,
    });
    await user.save();

    const mod = ctx.type === "slash" ? ctx.interaction!.user : ctx.message.author;
    await sendDM(target, "warning", reason, mod, ctx.message?.guild?.name);

    return `warned ${target.tag} for ${reason}`;
  }

  private async kick(ctx: CommandContext) {
    if (!await this.isMod(ctx)) return "nah";
    const { target, reason } = await resolveTarget(ctx);
    if (!target) return "ping someone";

    const user = await ensureUserMemory(target.id);
    user.moderation.infractions.push({
      type: "kick" as const,
      reason,
      moderatorId: ctx.userId,
      timestamp: new Date(),
      guildId: ctx.guildId,
      channelId: ctx.channelId,
    });
    await user.save();

    const guild = ctx.message?.guild || ctx.interaction?.guild;
    let member = null;
    if (guild) {
      member = await guild.members.fetch(target.id).catch(() => null);
      if (member && member.kickable) await member.kick(reason);
    }

    const mod = ctx.type === "slash" ? ctx.interaction!.user : ctx.message.author;
    await sendDM(target, "kick", reason, mod, guild?.name);

    return `recorded kick for ${target.tag} and ${member ? "removed them from the guild" : "could not fetch member"}`;
  }

  private async ban(ctx: CommandContext) {
    if (!await this.isMod(ctx)) return "nah";
    const { target, reason } = await resolveTarget(ctx);
    if (!target) return "ping someone";

    const user = await ensureUserMemory(target.id);
    user.moderation.banned = true;
    user.moderation.reason = reason;
    user.moderation.bannedAt = new Date();
    user.moderation.bannedBy = ctx.userId;
    user.moderation.infractions.push({
      type: "ban" as const,
      reason,
      moderatorId: ctx.userId,
      timestamp: new Date(),
      guildId: ctx.guildId,
      channelId: ctx.channelId,
    });
    await user.save();

    const guild = ctx.message?.guild || ctx.interaction?.guild;
    let banResult = null;
    if (guild) {
      banResult = await guild.bans.create(target.id, { reason }).catch(() => null);
    }

    const mod = ctx.type === "slash" ? ctx.interaction!.user : ctx.message.author;
    await sendDM(target, "ban", reason, mod, guild?.name);

    return `recorded a ban for ${target.tag}${banResult ? " and banned them from the guild" : ""}`;
  }

  private async unban(ctx: CommandContext) {
    if (!await this.isMod(ctx)) return "nah";
    const { target } = await resolveTarget(ctx);
    if (!target) return "ping someone";

    const user = await ensureUserMemory(target.id);
    if (!user.moderation.banned) return "they weren't banned";

    user.moderation.banned = false;
    user.moderation.reason = null;
    user.moderation.bannedAt = null;
    user.moderation.bannedBy = null;
    await user.save();

    const guild = ctx.message?.guild || ctx.interaction?.guild;
    if (guild) {
      await guild.members.unban(target.id).catch(() => null);
    }

    return `unblocked ${target.tag}`;
  }

  private async history(ctx: CommandContext) {
    if (!await this.isMod(ctx)) return "nah";
    const { target } = await resolveTarget(ctx);
    if (!target) return "ping someone";

    const user = await ensureUserMemory(target.id);
    const infractions = user.moderation.infractions || [];
    if (!infractions.length) return `${target.tag} has no recorded infractions.`;

    const lines = infractions.slice(-25).map((entry: any, index: number) =>
      `${index + 1}. [${entry.type.toUpperCase()}] ${entry.reason || "no reason"} • <@${entry.moderatorId}> • <t:${Math.floor(new Date(entry.timestamp).getTime() / 1000)}:R>`,
    );

    return `**Infractions for ${target.tag}**\n${lines.join("\n")}`.slice(0, 1900);
  }

  private async banInfo(ctx: CommandContext) {
    if (!await this.isMod(ctx)) return "nah";
    const { target } = await resolveTarget(ctx);
    if (!target) return "ping someone or give an id";

    const user = await ensureUserMemory(target.id);
    if (!user.moderation.banned) return `${target.tag} is not banned.`;

    const mod = user.moderation;
    return `**Ban Info for ${target.tag}**\nReason: ${mod.reason || "none"}\nBanned By: <@${mod.bannedBy}>\nBanned At: <t:${Math.floor(new Date(mod.bannedAt!).getTime() / 1000)}:R>`;
  }

  private async banList(ctx: CommandContext) {
    if (!await this.isMod(ctx)) return "nah";

    const UserMemory = (await import("../../models/UserMemory")).default;
    const bannedUsers = await UserMemory.find({ "moderation.banned": true }).lean();

    if (!bannedUsers.length) return "nobody's banned rn";

    const client = ctx.message?.client || ctx.interaction?.client;
    const lines = await Promise.all(
      bannedUsers.map(async (entry: any, index: number) => {
        const fetchedUser = client ? await client.users.fetch(entry.userId).catch(() => null) : null;
        const name = fetchedUser ? fetchedUser.tag : `unknown user (${entry.userId})`;
        return `${index + 1}. ${name} - ${entry.moderation?.reason || "no reason"}`;
      }),
    );

    return `**Banned Users**\n${lines.join("\n")}`.slice(0, 1900);
  }

  private async isMod(ctx: CommandContext): Promise<boolean> {
    if (ctx.userId === env.ownerId) return true;
    if (!ctx.guildId) return false;

    const checkPerms = (perms: any) => {
      if (!perms || typeof perms.has !== "function") return false;
      return perms.has(PermissionFlagsBits.BanMembers) ||
        perms.has(PermissionFlagsBits.KickMembers) ||
        perms.has(PermissionFlagsBits.ManageMessages) ||
        perms.has(PermissionFlagsBits.Administrator);
    };

    if (ctx.type === "slash" && ctx.interaction?.member) {
      return checkPerms((ctx.interaction.member as any).permissions);
    }

    if (ctx.type === "prefix" || ctx.type === "mention") {
      if (ctx.message.member && "permissions" in ctx.message.member) {
        return checkPerms((ctx.message.member as any).permissions);
      }
    }

    return false;
  }
}
