import { connectDB } from "./services/DatabaseService";
import { register } from "./abilities/AbilityRegistry";
import { calculatorAbility } from "./abilities/CalculatorAbility";
import { webSearchAbility } from "./abilities/WebSearchAbility";
import { engine } from "./personality/PersonalityEngine";

register(calculatorAbility);
register(webSearchAbility);

export async function startApp(): Promise<void> {
  await connectDB();
  await engine.initialize();

  const { client } = await import("./client/Client");

  const SystemPrompt = (await import("./models/SystemPrompt")).default;
  const doc = await SystemPrompt.findOne({ key: "additions" });
  if (doc && doc.additions.length > 0) {
    console.log(`Loaded ${doc.additions.length} system prompt addition(s)`);
  }

  await client.login(process.env.DISCORD_TOKEN!);
}
