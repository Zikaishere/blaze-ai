import { Client, GatewayIntentBits, Partials } from "discord.js";
import { env } from "../config/index.js";
import * as telemetry from "../telemetry/recorder.js";

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

client.once("ready", async () => {
  console.log(`Charlie online as ${client.user?.tag}`);
  client.user?.setPresence({
    activities: [{ name: "jus chillin, ping me if u need sum", type: 0 }],
    status: "idle",
  });

  telemetry.setGuildCount(client.guilds.cache.size);

  setInterval(async () => {
    telemetry.setGuildCount(client.guilds.cache.size);
    await telemetry.snapshot();
    telemetry.reset();
  }, 3600000);

  // Lazy-load event handlers to avoid circular deps at import time
  const { registerSlashCommands } = await import("./events/Ready");
  await registerSlashCommands(client);

  const { handleMessage } = await import("./events/MessageCreate");
  const { handleInteraction } = await import("./events/InteractionCreate");

  client.on("messageCreate", handleMessage);
  client.on("interactionCreate", handleInteraction);
});
