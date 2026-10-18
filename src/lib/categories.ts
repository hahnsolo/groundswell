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

export const STATUSES = {
  open: { label: "Open", className: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200" },
  in_progress: { label: "Being worked on", className: "bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-200" },
  resolved: { label: "Resolved", className: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200" },
} as const;

export type StatusId = keyof typeof STATUSES;

export function getStatus(id: string) {
  return STATUSES[id as StatusId] ?? STATUSES.open;
}
