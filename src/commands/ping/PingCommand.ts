import { SlashCommandBuilder } from "discord.js";
import { BaseCommand } from "../base/BaseCommand.js";
import type { CommandContext } from "../types.js";

export class PingCommand extends BaseCommand {
  name = "ping";
  description = "Check if Charlie is alive";
  aliases = ["pong"];

  slashCommand = new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check if Charlie is alive");

  async run(_ctx: CommandContext): Promise<string> {
    return "pong";
  }
}
