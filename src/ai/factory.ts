import type { AIProvider } from "./AIProvider";
import { groqProvider } from "./groq/GroqProvider";

let currentProvider: AIProvider | null = null;

export function getProvider(): AIProvider {
  if (!currentProvider) {
    currentProvider = groqProvider;
  }
  return currentProvider;
}

export function setProvider(provider: AIProvider): void {
  currentProvider = provider;
}
