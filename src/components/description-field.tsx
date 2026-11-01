"use client";

import { useState } from "react";
import { countWords, DESCRIPTION_PROMPTS, MAX_DESCRIPTION_WORDS, MIN_DESCRIPTION_WORDS } from "@/lib/words";
import { inputStyles } from "./styles";

/**
 * A cause's description, with the questions it should answer and a live word
 * count. The server checks the same limits (src/lib/words.ts).
 */
export function DescriptionField({ defaultValue, error }: { defaultValue?: string; error?: string }) {
  const [words, setWords] = useState(() => countWords(defaultValue ?? ""));
  const enough = words >= MIN_DESCRIPTION_WORDS;
  const tooMany = words > MAX_DESCRIPTION_WORDS;
  // Screen readers hear the count only when it changes state, not on every keystroke.
  const status = tooMany ? "Too long" : enough ? "Enough detail" : "Needs more detail";

  return (
    <div className="space-y-1.5">
      <label htmlFor="description" className="text-sm font-medium">
        Details
      </label>
      <ul id="description-prompts" className="grid gap-x-4 gap-y-0.5 text-xs text-muted sm:grid-cols-2">
        {DESCRIPTION_PROMPTS.map((p) => (
          <li key={p} className="flex gap-1.5">
            <span aria-hidden="true">•</span>
            {p}
          </li>
        ))}
      </ul>
      <textarea
        id="description"
        name="description"
        required
        rows={8}
        defaultValue={defaultValue}
        onChange={(e) => setWords(countWords(e.target.value))}
        aria-describedby="description-prompts description-count"
        aria-invalid={!!error || undefined}
        className={inputStyles}
      />
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-xs">
        {error ? <span className="text-sm text-red-600 dark:text-red-400">{error}</span> : <span className="text-muted">Don&apos;t include anyone&apos;s private info.</span>}
        <span
          id="description-count"
          className={`tabular-nums ${tooMany ? "font-semibold text-red-600 dark:text-red-400" : enough ? "font-semibold text-foreground" : "text-muted"}`}
        >
          {tooMany
            ? `${words} words: keep it under ${MAX_DESCRIPTION_WORDS}`
            : enough
              ? `✓ Good detail (${words} words)`
              : `${words} of ${MIN_DESCRIPTION_WORDS} words`}
        </span>
      </div>
      <span className="sr-only" role="status" aria-live="polite">
        {status}
      </span>
    </div>
  );
}
