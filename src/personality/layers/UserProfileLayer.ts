import type { PersonalityLayer } from "../../types/personality.js";

export function getUserProfileLayer(params: {
  userName: string;
  userProfile?: string;
  facts?: string[];
  interests?: string[];
  customFacts?: string[];
  memoryEnabled: boolean;
}): PersonalityLayer | null {
  const { userName, userProfile, facts, interests, customFacts, memoryEnabled } = params;
  const parts: string[] = [];

  parts.push(`The user you are currently talking to is named "${userName}".`);

  if (memoryEnabled && interests && interests.length > 0) {
    parts.push(`Recurring topics: ${interests.join(", ")}`);
  }

  if (memoryEnabled && userProfile) {
    parts.push(`What you remember about this user:\n${userProfile}`);
  }

  if (memoryEnabled && facts && facts.length > 0) {
    const unique = [...new Set(facts)];
    parts.push(`Key facts:\n- ${unique.join("\n- ")}`);
  }

  if (customFacts && customFacts.length > 0) {
    parts.push(`Facts ${userName} shared about themself:\n- ${customFacts.join("\n- ")}`);
  }

  if (parts.length <= 1) return null;

  const content = parts.join("\n\n");
  return {
    name: "user-profile",
    priority: 40,
    tokens: Math.ceil(content.length / 4),
    content,
  };
}
