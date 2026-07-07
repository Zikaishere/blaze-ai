import type { PersonalityLayer } from "../types/personality";
import type { DnaTrait } from "../types/personality";
import { getCoreIdentityLayer } from "./layers/CoreIdentity";
import { getSpeechStyleLayer } from "./layers/SpeechStyle";
import { getBehaviorRulesLayer } from "./layers/BehaviorRules";
import { getServerDNALayer } from "./layers/ServerDNALayer";
import { getUserProfileLayer } from "./layers/UserProfileLayer";
import { getAbilitiesLayer } from "./layers/AbilitiesLayer";
import { getRecentContextLayer } from "./layers/RecentContextLayer";
import { getMemoryLayer } from "./layers/MemoryLayer";
import { loadTemplates, getLoadedCount } from "./templates";
import { buildSystemPrompt } from "../ai/PromptBuilder";

export interface PersonalityInput {
  userName: string;
  style?: string;
  additions: string[];
  guildAdditions: string[];
  guildMemories?: string[];
  dna: { traits: DnaTrait; confidence: number; topSlang?: string[] } | null;
  userProfile?: string;
  facts?: string[];
  interests?: string[];
  customFacts?: string[];
  memoryEnabled: boolean;
  abilityNames: string[];
}

export class PersonalityEngine {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    await loadTemplates();
    this.initialized = true;
    console.log(`PersonalityEngine ready (${getLoadedCount()} templates)`);
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  assemble(input: PersonalityInput): PersonalityLayer[] {
    const layers: PersonalityLayer[] = [];

    const core = getCoreIdentityLayer();
    if (core) layers.push(core);

    const rules = getBehaviorRulesLayer();
    if (rules) layers.push(rules);

    const style = getSpeechStyleLayer(input.style);
    if (style) layers.push(style);

    const dna = getServerDNALayer(input.dna);
    if (dna) layers.push(dna);

    const abilities = getAbilitiesLayer(input.abilityNames);
    if (abilities) layers.push(abilities);

    const profile = getUserProfileLayer({
      userName: input.userName,
      userProfile: input.userProfile,
      facts: input.facts,
      interests: input.interests,
      customFacts: input.customFacts,
      memoryEnabled: input.memoryEnabled,
    });
    if (profile) layers.push(profile);

    const context = getRecentContextLayer(input.additions, input.guildAdditions);
    if (context) layers.push(context);

    const memories = getMemoryLayer(input.guildMemories);
    if (memories) layers.push(memories);

    return layers;
  }

  build(input: PersonalityInput): string {
    const layers = this.assemble(input);
    return buildSystemPrompt(layers);
  }
}

export const engine = new PersonalityEngine();
