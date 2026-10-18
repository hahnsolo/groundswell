"use client";

import { useActionState } from "react";
import { createIssue } from "@/app/actions/community";
import { CATEGORIES } from "@/lib/categories";
import { COUNTRIES } from "@/lib/countries";
import { Field, FormError, SubmitButton, inputStyles } from "./ui";

export function IssueForm({ country, postal }: { country: string; postal: string }) {
  const [state, action] = useActionState(createIssue, null);
  const e = state?.fieldErrors;
  return (
    <form action={action} className="space-y-5">
      <FormError message={state?.error} />
      <Field label="What's the issue?" name="title" errors={e} hint="Short and specific: “No crosswalk at Elm & 5th near the school”">
        <input name="title" required maxLength={120} className={inputStyles} />
      </Field>
      <Field label="Category" name="category" errors={e}>
        <select name="category" required defaultValue="" className={inputStyles}>
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
      <Field
        label="Details"
        name="description"
        errors={e}
        hint="What's happening, who it affects, and what a good outcome looks like. Don't include anyone's private info."
      >
        <textarea name="description" required rows={7} maxLength={5000} className={inputStyles} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Country" name="country" errors={e}>
          <select name="country" defaultValue={country} className={inputStyles}>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Postal / ZIP code" name="postal" errors={e} hint="Where the issue is. Only the area is stored.">
          <input name="postal" defaultValue={postal} required className={inputStyles} />
        </Field>
      </div>
      <SubmitButton pendingText="Posting…">Post issue</SubmitButton>
    </form>
  );
}
