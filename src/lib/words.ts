// How much a cause's description needs to say. Shared by the cause form (its
// live counter) and the server (which enforces it). Counting words rather than
// characters means "!!!!!!" doesn't help and clear, short words don't hurt.

export const MIN_DESCRIPTION_WORDS = 50;
export const MAX_DESCRIPTION_WORDS = 1000;

/** The questions a good description answers, shown under the box. */
export const DESCRIPTION_PROMPTS = [
  "What's happening?",
  "Where exactly? (a corner, a building or a park, not your home address)",
  "Who does it affect?",
  "What would fixing it look like?",
] as const;

/** Words are runs of non-space text containing a letter or digit; a link counts as one, a lone emoji or "—" as none. */
export function countWords(text: string) {
  return text.split(/\s+/).filter((t) => /[\p{L}\p{N}]/u.test(t)).length;
}

export const DESCRIPTION_TOO_SHORT = `Add a bit more so neighbours can decide to join: where is it, who does it affect, and what would fixing it look like? (At least ${MIN_DESCRIPTION_WORDS} words.)`;
export const DESCRIPTION_TOO_LONG = `That's a lot to read. Keep it under ${MAX_DESCRIPTION_WORDS} words; you can add more in the chat.`;

/** The problem with a description, in plain words, or null if it's fine. */
export function descriptionProblem(text: string) {
  const n = countWords(text);
  if (n < MIN_DESCRIPTION_WORDS) return DESCRIPTION_TOO_SHORT;
  if (n > MAX_DESCRIPTION_WORDS) return DESCRIPTION_TOO_LONG;
  return null;
}
