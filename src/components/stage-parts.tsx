"use client";

import { useState } from "react";
import { closeCause, logContact, logReply, proposeWin } from "@/app/actions/community";
import { Field, FormError, SubmitButton, inputStyles, useFormAction } from "./ui";
import { Honeypot } from "./bot-check";

/** A leader tool tucked behind its summary line, open again if the last submit had a problem. */
function Tool({ summary, open, children }: { summary: string; open: boolean; children: React.ReactNode }) {
  return (
    <details className="text-sm" open={open}>
      <summary className="cursor-pointer text-muted hover:text-foreground">{summary}</summary>
      <div className="mt-3 max-w-xl">{children}</div>
    </details>
  );
}

export function ProposeWinForm({ causeId }: { causeId: string }) {
  const [state, action] = useFormAction(proposeWin);
  return (
    <Tool summary="It's fixed: propose a win" open={!!state && !state.ok}>
      <form action={action} className="space-y-3">
        <input type="hidden" name="causeId" value={causeId} />
        <p className="text-muted">Members are asked to confirm. It&apos;s won once enough of them agree within 7 days.</p>
        <FormError message={state?.error} />
        <Field label="What happened?" name="note" errors={state?.fieldErrors}>
          <textarea name="note" required rows={2} maxLength={500} placeholder="The city installed the crossing on March 3." defaultValue={state?.values?.note} className={inputStyles} />
        </Field>
        <Honeypot />
        <SubmitButton variant="secondary" pendingText="Sending…">
          Ask members to confirm
        </SubmitButton>
      </form>
    </Tool>
  );
}

export function CloseCauseForm({ causeId }: { causeId: string }) {
  const [state, action] = useFormAction(closeCause);
  return (
    <Tool summary="Close this cause" open={!!state && !state.ok}>
      <form action={action} className="space-y-3">
        <input type="hidden" name="causeId" value={causeId} />
        <p className="text-muted">
          For a cause that&apos;s stopped without a win. It stays readable, the chat becomes read-only, and you can reopen it for 30 days.
        </p>
        <FormError message={state?.error} />
        <Field label="Why are you closing it?" name="reason" errors={state?.fieldErrors}>
          <input name="reason" required maxLength={300} placeholder="The city said no, and there isn't enough interest to keep going." defaultValue={state?.values?.reason} className={inputStyles} />
        </Field>
        <Honeypot />
        <SubmitButton variant="secondary" pendingText="Closing…">
          Close the cause
        </SubmitButton>
      </form>
    </Tool>
  );
}

function today() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "We contacted them": who, how, when. Moves the cause to Taking action. */
export function LogContactForm({ causeId, suggestedWho }: { causeId: string; suggestedWho: string }) {
  const [state, action] = useFormAction(logContact);
  const [date] = useState(today);
  const e = state?.fieldErrors;
  return (
    <Tool summary="Add to the timeline: we contacted someone" open={!!state && !state.ok}>
      <form action={action} className="space-y-3">
        <input type="hidden" name="causeId" value={causeId} />
        <FormError message={state?.error} />
        <Field label="Who?" name="who" errors={e}>
          <input name="who" required maxLength={120} defaultValue={state?.values?.who ?? suggestedWho} className={inputStyles} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="How?" name="how" errors={e}>
            <select name="how" required defaultValue={state?.values?.how ?? "email"} className={inputStyles}>
              <option value="email">Email</option>
              <option value="letter">Letter</option>
              <option value="call">Phone call</option>
              <option value="meeting">Meeting</option>
            </select>
          </Field>
          <Field label="When?" name="happenedAt" errors={e}>
            <input name="happenedAt" type="date" required max={date} defaultValue={state?.values?.happenedAt ?? date} suppressHydrationWarning className={inputStyles} />
          </Field>
        </div>
        <Field label="Anything to add? (optional)" name="note" errors={e}>
          <input name="note" maxLength={500} placeholder="Sent the petition with 150 signatures." defaultValue={state?.values?.note} className={inputStyles} />
        </Field>
        <Honeypot />
        <div className="flex items-center gap-3">
          <SubmitButton variant="secondary" pendingText="Adding…">
            Add to timeline
          </SubmitButton>
          {state?.ok && <span className="text-muted">Added.</span>}
        </div>
      </form>
    </Tool>
  );
}

export function LogReplyForm({ causeId }: { causeId: string }) {
  const [state, action] = useFormAction(logReply);
  return (
    <Tool summary="Add to the timeline: they replied" open={!!state && !state.ok}>
      <form action={action} className="space-y-3">
        <input type="hidden" name="causeId" value={causeId} />
        <FormError message={state?.error} />
        <Field label="What did they say?" name="note" errors={state?.fieldErrors}>
          <input name="note" required maxLength={500} placeholder="The councillor will raise it at the next meeting." defaultValue={state?.values?.note} className={inputStyles} />
        </Field>
        <Honeypot />
        <div className="flex items-center gap-3">
          <SubmitButton variant="secondary" pendingText="Adding…">
            Add to timeline
          </SubmitButton>
          {state?.ok && <span className="text-muted">Added.</span>}
        </div>
      </form>
    </Tool>
  );
}
