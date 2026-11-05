"use client";

import { useEffect, useRef, useState } from "react";
import { createCause, editCause } from "@/app/actions/community";
import { CATEGORIES } from "@/lib/categories";
import { COUNTRIES } from "@/lib/countries";
import { Field, FormError, SubmitButton, inputStyles, useFormAction } from "./ui";
import { Honeypot } from "./bot-check";
import { DescriptionField } from "./description-field";
import { FixerField } from "./fixer-field";

/** Lets the person who started a cause fix its title and description. */
export function EditCauseForm({ causeId, title, description }: { causeId: string; title: string; description: string }) {
  const [state, action] = useFormAction(editCause);
  const v = state?.values;
  return (
    <details className="text-sm" open={!!state && !state.ok}>
      <summary className="cursor-pointer text-muted hover:text-foreground">Edit title and description</summary>
      <form action={action} className="mt-3 max-w-2xl space-y-4">
        <input type="hidden" name="causeId" value={causeId} />
        <FormError message={state?.error} />
        <Field label="What's the cause?" name="title" errors={state?.fieldErrors}>
          <input name="title" required maxLength={120} defaultValue={v?.title ?? title} className={inputStyles} />
        </Field>
        <DescriptionField defaultValue={v?.description ?? description} error={state?.fieldErrors?.description?.[0]} />
        <Honeypot />
        <div className="flex items-center gap-3">
          <SubmitButton variant="secondary" pendingText="Saving…">
            Save changes
          </SubmitButton>
          {state?.ok && <span className="text-muted">Saved.</span>}
        </div>
      </form>
    </details>
  );
}

export function CauseForm({ country, postal }: { country: string; postal: string }) {
  const [state, action] = useFormAction(createCause);
  const e = state?.fieldErrors;
  const v = state?.values;
  // React resets a form after every submit and dropdowns don't pick their
  // choice back up, so a refused cause would lose these. Put them back after each result.
  const [category, setCategory] = useState("");
  const [countryCode, setCountryCode] = useState(country);
  const categoryBox = useRef<HTMLSelectElement>(null);
  const countryBox = useRef<HTMLSelectElement>(null);
  useEffect(() => {
    if (categoryBox.current) categoryBox.current.value = category;
    if (countryBox.current) countryBox.current.value = countryCode;
  }, [state, category, countryCode]);
  return (
    <form action={action} className="space-y-5">
      <FormError message={state?.error} />
      <Field label="What's the cause?" name="title" errors={e} hint="Short and specific: “No crosswalk at Elm & 5th near the school”">
        <input name="title" required maxLength={120} defaultValue={v?.title} className={inputStyles} />
      </Field>
      <Field label="Category" name="category" errors={e}>
        <select ref={categoryBox} name="category" required value={category} onChange={(ev) => setCategory(ev.target.value)} className={inputStyles}>
          <option value="" disabled>
            Choose one…
          </option>
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.emoji} {c.label}
            </option>
          ))}
        </select>
      </Field>
      <DescriptionField defaultValue={v?.description} error={e?.description?.[0]} />
      <FixerField country={countryCode} defaultOther={v?.fixerOther} errors={e} formState={state} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Country" name="country" errors={e}>
          <select ref={countryBox} name="country" value={countryCode} onChange={(ev) => setCountryCode(ev.target.value)} className={inputStyles}>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Postal / ZIP code" name="postal" errors={e} hint="Where it is. Only the area is stored.">
          <input name="postal" defaultValue={v?.postal ?? postal} required className={inputStyles} />
        </Field>
      </div>
      <Honeypot />
      <SubmitButton pendingText="Posting…">Start this cause</SubmitButton>
    </form>
  );
}
