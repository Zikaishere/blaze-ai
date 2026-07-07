import UserProfile from "./models/UserProfile";
import { extractFacts, stripPII } from "./FactExtractor";
import { updateTopicCounts, getTopInterests } from "./InterestTracker";

const EXTRACTION_INTERVAL = 5;

export async function getProfile(userId: string): Promise<{
  profile: string;
  facts: string[];
  interests: string[];
} | null> {
  try {
    const doc = await UserProfile.findOne({ userId }).lean();
    if (!doc) return null;
    const topicMap = doc.topicCounts instanceof Map
      ? doc.topicCounts
      : new Map(Object.entries(doc.topicCounts || {}));
    const interests = getTopInterests(topicMap, 10);
    return { profile: doc.profile || "", facts: doc.facts || [], interests };
  } catch {
    return null;
  }
}

export async function updateProfile(
  userId: string,
  userName: string,
  userMessage: string,
  history: { role: string; content: string }[],
): Promise<void> {
  try {
    let doc = await UserProfile.findOne({ userId });
    if (!doc) {
      doc = new UserProfile({ userId });
    }

    doc.messageCount = (doc.messageCount || 0) + 1;
    doc.topicCounts = updateTopicCounts(doc.topicCounts || new Map(), userMessage);

    const shouldExtract =
      doc.messageCount % EXTRACTION_INTERVAL === 0 || userMessage.length >= 30;

    if (shouldExtract) {
      const result = await extractFacts(
        userName,
        stripPII(userMessage.slice(0, 500)),
        history,
        doc.profile,
        doc.facts,
      );

      if (result.profile) {
        doc.profile = result.profile;
      }

      if (result.obsoleteFactIndices.length > 0) {
        const toRemove = new Set(result.obsoleteFactIndices);
        doc.facts = doc.facts.filter((_, i) => !toRemove.has(i));
      }

      if (result.newFacts.length > 0) {
        const existing = new Set(
          doc.facts.map((f) => f.toLowerCase().replace(/\s+/g, " ")),
        );
        for (const fact of result.newFacts) {
          const key = fact.toLowerCase().replace(/\s+/g, " ");
          if (!existing.has(key)) {
            doc.facts.push(fact);
            existing.add(key);
          }
        }
      }

      doc.lastExtractedAt = new Date();
    }

    doc.interests = getTopInterests(doc.topicCounts, 10);
    await doc.save();
  } catch (error) {
    console.error("Profile update failed:", error);
  }
}
