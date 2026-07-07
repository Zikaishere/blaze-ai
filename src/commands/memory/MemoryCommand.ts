import { BaseCommand } from "../base/BaseCommand.js";
import type { CommandContext } from "../types.js";
import { memoryManager } from "../../memory/MemoryManager.js";

export class MemoryCommand extends BaseCommand {
  name = "memory";
  description = "Manage memories: remember, recall, list, forget";
  aliases = ["remember", "whatdoiknow", "forget"];

  async run(ctx: CommandContext): Promise<string | null> {
    const sub = ctx.args[0]?.toLowerCase();

    if (!sub || sub === "list") {
      return this.listMemories(ctx);
    }

    if (sub === "forget" || sub === "delete" || sub === "remove") {
      return this.deleteMemory(ctx);
    }

    if (sub === "search") {
      return this.searchMemories(ctx);
    }

    if (sub === "help") {
      return "`b.memory <key> = <value>` — store a memory\n`b.memory list` — show recent memories\n`b.memory search <query>` — search memories\n`b.memory forget <key>` — delete a memory\n`b.whatdoiknow` — same as `b.memory list`";
    }

    const eqIdx = ctx.args.indexOf("=");
    if (eqIdx > 0) {
      const key = ctx.args.slice(0, eqIdx).join(" ");
      const value = ctx.args.slice(eqIdx + 1).join(" ").trim();
      if (!value) return "what should i remember?";
      await memoryManager.set("guild", ctx.guildId || "global", key, value, [], ctx.userId);
      return `got it: **${key}**`;
    }

    const value = await memoryManager.get("guild", ctx.guildId || "global", sub);
    if (value) return `**${sub}**: ${value}`;
    return `dont know anything about "${sub}"`;
  }

  private async listMemories(ctx: CommandContext): Promise<string> {
    const memories = await memoryManager.list("guild", ctx.guildId || "global", 10);
    if (memories.length === 0) return "nothing stored yet";
    const lines = memories.map(
      (m) => `**${m.key}**: ${m.value}`,
    );
    return `stored memories:\n${lines.join("\n")}`;
  }

  private async deleteMemory(ctx: CommandContext): Promise<string> {
    const key = ctx.args.slice(1).join(" ");
    if (!key) return "what should i forget?";
    const ok = await memoryManager.delete("guild", ctx.guildId || "global", key);
    return ok ? `forgot **${key}**` : `i dont know anything about "${key}"`;
  }

  private async searchMemories(ctx: CommandContext): Promise<string> {
    const query = ctx.args.slice(1).join(" ");
    if (!query) return "search for what?";
    const results = await memoryManager.search("guild", ctx.guildId || "global", query, 5);
    if (results.length === 0) return `nothing matches "${query}"`;
    const lines = results.map((r) => `**${r.key}**: ${r.value}`);
    return `memories matching "${query}":\n${lines.join("\n")}`;
  }
}
