"use client";

import { useState } from "react";
import { setCauseContact } from "@/app/actions/community";
import { Field, FormError, SubmitButton, inputStyles, useFormAction } from "./ui";
import { Honeypot } from "./bot-check";

/** "Copy email", with a fallback for browsers that refuse clipboard access. */
export function CopyEmail({ email }: { email: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="text-link underline"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(email);
          setCopied(true);
        } catch {
          window.prompt("Copy this email:", email);
        }
      }}
    >
      {copied ? "Copied" : `Copy email (${email})`}
    </button>
  );
}

/** The cause's leader adds someone to contact by hand. */
export function ContactForm({ causeId, name, role, email }: { causeId: string; name: string | null; role: string | null; email: string | null }) {
  const [state, action] = useFormAction(setCauseContact);
  const e = state?.fieldErrors;
  const v = state?.values;
  return (
    <details className="text-sm" open={!!state && !state.ok}>
      <summary className="cursor-pointer text-muted hover:text-foreground">{name ? "Change who to contact" : "Add someone to contact"}</summary>
      <form action={action} className="mt-3 max-w-lg space-y-3">
        <input type="hidden" name="causeId" value={causeId} />
        <p className="text-muted">For someone we don&apos;t list: your councillor, a landlord, a school board. Leave the name empty to remove it.</p>
        <FormError message={state?.error} />
        <Field label="Name" name="contactName" errors={e}>
          <input name="contactName" maxLength={80} defaultValue={v?.contactName ?? name ?? ""} className={inputStyles} />
        </Field>
        <Field label="Role (optional)" name="contactRole" errors={e}>
          <input name="contactRole" maxLength={80} placeholder="Ward 10 councillor" defaultValue={v?.contactRole ?? role ?? ""} className={inputStyles} />
        </Field>
        <Field label="Email (optional)" name="contactEmail" errors={e}>
          <input name="contactEmail" type="email" maxLength={120} defaultValue={v?.contactEmail ?? email ?? ""} className={inputStyles} />
        </Field>
        <Honeypot />
        <div className="flex items-center gap-3">
          <SubmitButton variant="secondary" pendingText="Saving…">
            Save
          </SubmitButton>
          {state?.ok && <span className="text-muted">Saved.</span>}
        </div>
      </form>
    </details>
  );
}
