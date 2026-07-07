import { EmbedBuilder } from "discord.js";
import { BaseCommand } from "../base/BaseCommand.js";
import type { CommandContext } from "../types.js";
import { getProfile } from "../../user-profiles/ProfileEngine.js";

export class ProfileCommand extends BaseCommand {
  name = "profile";
  description = "View your user profile";
  aliases = ["me"];

  async run(ctx: CommandContext): Promise<string | { embeds: any[] } | null> {
    const targetId = ctx.message.mentions?.users?.first()?.id || ctx.userId;
    const profile = await getProfile(targetId);
    const tag = ctx.message.mentions?.users?.first()?.tag || "You";

    if (!profile) return `${tag} dont have a profile yet — start chatting first`;

    const embed = new EmbedBuilder()
      .setColor(0xff6a00)
      .setTitle(`${tag}'s Profile`)
      .setDescription(profile.profile || "No profile summary yet")
      .addFields(
        { name: "Facts", value: profile.facts.length ? profile.facts.map((f, i) => `${i + 1}. ${f}`).join("\n").slice(0, 1024) : "None yet", inline: false },
        { name: "Interests", value: profile.interests.length ? profile.interests.join(", ") : "Still forming", inline: false },
      );

    return { embeds: [embed] };
  }
}
