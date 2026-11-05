export const CATEGORIES = [
  { id: "safety", label: "Safety", emoji: "🛡️" },
  { id: "transit", label: "Roads & transit", emoji: "🚌" },
  { id: "housing", label: "Housing", emoji: "🏠" },
  { id: "environment", label: "Environment", emoji: "🌳" },
  { id: "parks", label: "Parks & recreation", emoji: "⛲" },
  { id: "schools", label: "Schools & youth", emoji: "🎒" },
  { id: "health", label: "Health", emoji: "🩺" },
  { id: "business", label: "Local business", emoji: "🏪" },
  { id: "utilities", label: "Utilities & services", emoji: "💡" },
  { id: "other", label: "Other", emoji: "📌" },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];

export const CATEGORY_IDS = CATEGORIES.map((c) => c.id) as [CategoryId, ...CategoryId[]];

export function getCategory(id: string) {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];
}
