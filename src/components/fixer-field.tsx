"use client";

import { useEffect, useRef, useState } from "react";
import { setIssueFixer } from "@/app/actions/community";
import { FIXER_OTHER_MAX, FIXERS, fixerEmoji, fixerLabel, type FixerId } from "@/lib/fixers";
import { inputStyles } from "./styles";
import { FormError, SubmitButton, useFormAction } from "./ui";

/** Lets the person who raised a cause change who they think should fix it. */
export function FixerChangeForm({ issueId, country, fixer, fixerOther }: { issueId: string; country: string; fixer: string; fixerOther: string | null }) {
  const [state, action] = useFormAction(setIssueFixer);
  return (
    <details className="text-sm" open={!!state && !state.ok}>
      <summary className="cursor-pointer text-muted hover:text-foreground">Change who should fix it</summary>
      <form action={action} className="mt-3 max-w-xl space-y-3">
        <input type="hidden" name="issueId" value={issueId} />
        <FormError message={state?.error} />
        <FixerField country={country} defaultValue={fixer} defaultOther={state?.values?.fixerOther ?? fixerOther ?? undefined} errors={state?.fieldErrors} formState={state} />
        <SubmitButton variant="secondary" pendingText="Saving…">
          Save
        </SubmitButton>
        {state?.ok && <span className="ml-3 text-sm text-muted">Saved.</span>}
      </form>
    </details>
  );
}

/** "Who do you think should fix this?": one choice, plus a short box for "Something else". */
export function FixerField({
  country,
  defaultValue,
  defaultOther,
  errors,
  formState,
}: {
  country: string;
  defaultValue?: string;
  defaultOther?: string;
  errors?: Record<string, string[] | undefined>;
  /** The form's action state: after each submit React resets the form, so the choice is put back. */
  formState?: unknown;
}) {
  const [choice, setChoice] = useState<string>(defaultValue ?? "");
  const box = useRef<HTMLFieldSetElement>(null);
  useEffect(() => {
    box.current?.querySelectorAll<HTMLInputElement>('input[name="fixer"]').forEach((r) => (r.checked = r.value === choice));
  }, [formState, choice]);
  const error = errors?.fixer?.[0] ?? errors?.fixerOther?.[0];
  return (
    <fieldset ref={box} className="space-y-2">
      <legend className="text-sm font-medium">Who do you think should fix this?</legend>
      <p className="text-xs text-muted">Not sure is fine. Neighbours can help work it out.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {FIXERS.map((f) => (
          <label
            key={f.id}
            className="flex cursor-pointer items-center gap-2 rounded-md border-[1.5px] border-border bg-surface px-3 py-2 text-sm has-[:checked]:border-ink has-[:checked]:bg-mustard/25 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ink"
          >
            <input
              type="radio"
              name="fixer"
              value={f.id}
              required
              checked={choice === f.id}
              onChange={() => setChoice(f.id as FixerId)}
              className="accent-[var(--ink)]"
            />
            <span aria-hidden="true">{fixerEmoji(f.id, country)}</span>
            {fixerLabel(f, country)}
          </label>
        ))}
      </div>
      {choice === "other" && (
        <input
          name="fixerOther"
          required
          maxLength={FIXER_OTHER_MAX}
          defaultValue={defaultOther}
          placeholder="Who? For example: the school board, the transit agency"
          aria-label="Who should fix it"
          className={inputStyles}
        />
      )}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </fieldset>
  );
}
