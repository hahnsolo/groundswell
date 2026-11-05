"use client";

import { useState, useSyncExternalStore } from "react";
import { addComment, createCampaign, createMeetup, editComment, editMeetup, signCampaign, unsignCampaign } from "@/app/actions/community";
import { Field, FormError, SubmitButton, buttonStyles, inputStyles, useFormAction } from "./ui";
import type { FormState } from "@/lib/forms";
import { Honeypot } from "./bot-check";
import { defaultEnd } from "@/lib/event-times";

export function CommentForm({ causeId }: { causeId: string }) {
  // On success React clears the box; on error the text comes back via state.values.
  const [state, action] = useFormAction(addComment);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="causeId" value={causeId} />
      <FormError message={state?.error} />
      <textarea
        name="body"
        required
        rows={2}
        maxLength={3000}
        placeholder="Write a message to your neighbours…"
        defaultValue={state?.values?.body}
        className={inputStyles}
        aria-label="Your message"
      />
      {state?.fieldErrors?.body?.[0] && <p className="text-sm text-red-600">{state.fieldErrors.body[0]}</p>}
      <Honeypot />
      <SubmitButton pendingText="Sending…">Send</SubmitButton>
    </form>
  );
}

/** "Edit" on your own message (shown for 15 minutes after sending); opens it in place. */
export function MessageEditor({ commentId, body, children }: { commentId: string; body: string; children: React.ReactNode }) {
  const [editing, setEditing] = useState(false);
  const [state, action] = useFormAction(async (prev: FormState, formData: FormData) => {
    const result = await editComment(prev, formData);
    if (result?.ok) setEditing(false);
    return result;
  });
  if (!editing) {
    return (
      <>
        {children}
        <button type="button" onClick={() => setEditing(true)} className="ml-2 text-xs text-muted underline hover:text-foreground">
          Edit
        </button>
      </>
    );
  }
  return (
    <form action={action} className="mt-1 w-full max-w-lg space-y-2 text-left">
      <input type="hidden" name="commentId" value={commentId} />
      <FormError message={state?.error} />
      <textarea
        name="body"
        required
        rows={3}
        maxLength={3000}
        defaultValue={state?.values?.body ?? body}
        aria-label="Edit your message"
        autoFocus
        className={inputStyles}
      />
      <Honeypot />
      <div className="flex items-center gap-2">
        <SubmitButton pendingText="Saving…" className="!px-3 !py-1 text-xs">
          Save
        </SubmitButton>
        <button type="button" onClick={() => setEditing(false)} className="text-xs text-muted underline hover:text-foreground">
          Cancel
        </button>
      </div>
    </form>
  );
}

function toLocalInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** An existing event, for editing. Times as ISO strings. */
export type EditableEvent = {
  id: string;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  location: string;
  isOnline: boolean;
  capacity: number | null;
};

const noSubscribe = () => () => {};

/** The host's "Edit event details" form. Rendered in the browser only, so times start in the host's time zone. */
export function EditEventForm({ event }: { event: EditableEvent }) {
  const inBrowser = useSyncExternalStore(noSubscribe, () => true, () => false);
  return inBrowser ? <MeetupForm event={event} /> : null;
}

/** Organize a new event for a cause, or (given `event`) let its host change the details. */
export function MeetupForm({ causeId, event }: { causeId?: string; event?: EditableEvent }) {
  const [state, action] = useFormAction(event ? editMeetup : createMeetup);
  // An event's times are in the host's own time zone, which only the browser knows
  // (so EditEventForm only renders this in the browser).
  const [local, setLocal] = useState(() => (event ? toLocalInputValue(new Date(event.startsAt)) : ""));
  const [localEnd, setLocalEnd] = useState(() => (event ? toLocalInputValue(new Date(event.endsAt)) : ""));
  // The end follows the start (2 hours later) until the organizer picks one themselves.
  const [endTouched, setEndTouched] = useState(!!event);
  const [online, setOnline] = useState(event?.isOnline ?? false);
  const pickStart = (value: string) => {
    setLocal(value);
    if (!endTouched) setLocalEnd(value ? toLocalInputValue(defaultEnd(new Date(value))) : "");
  };
  // Lazy init: computed once in the browser's timezone; the server re-validates.
  // (An event that's already on keeps its start, so editing has no minimum.)
  const [min] = useState(() => (event ? undefined : toLocalInputValue(new Date())));
  const e = state?.fieldErrors;
  const v = state?.values;
  return (
    <form action={action} className="space-y-4">
      {event ? <input type="hidden" name="meetupId" value={event.id} /> : <input type="hidden" name="causeId" value={causeId} />}
      {/* Send an unambiguous UTC timestamp; the picker is in the organizer's own timezone. */}
      <input type="hidden" name="startsAt" value={local ? new Date(local).toISOString() : ""} />
      <input type="hidden" name="endsAt" value={localEnd ? new Date(localEnd).toISOString() : ""} />
      <FormError message={state?.error} />
      <Field label="Title" name="title" errors={e}>
        <input name="title" required placeholder="Neighbourhood walk-through" defaultValue={v?.title ?? event?.title} className={inputStyles} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Starts" name="startsAt" errors={e}>
          <input type="datetime-local" required min={min} suppressHydrationWarning value={local} onChange={(ev) => pickStart(ev.target.value)} className={inputStyles} />
        </Field>
        <Field label="Ends" name="endsAt" errors={e}>
          <input
            type="datetime-local"
            required
            min={local || min}
            suppressHydrationWarning
            value={localEnd}
            onChange={(ev) => {
              setEndTouched(true);
              setLocalEnd(ev.target.value);
            }}
            className={inputStyles}
          />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isOnline" checked={online} onChange={(ev) => setOnline(ev.target.checked)} />
        Online meetup
      </label>
      <Field label={online ? "Video link" : "Where"} name="location" errors={e} hint={online ? undefined : "A public place — library, café, park entrance."}>
        <input
          name="location"
          required
          placeholder={online ? "https://meet…" : "Central Library, room 2"}
          defaultValue={v?.location ?? event?.location}
          className={inputStyles}
        />
      </Field>
      <Field label="What's the plan? (optional)" name="description" errors={e}>
        <textarea name="description" rows={3} defaultValue={v?.description ?? event?.description} className={inputStyles} />
      </Field>
      <Field label="Capacity (optional)" name="capacity" errors={e}>
        <input name="capacity" type="number" min={2} defaultValue={v?.capacity ?? event?.capacity ?? undefined} className={`${inputStyles} w-32`} />
      </Field>
      <Honeypot />
      <div className="flex items-center gap-3">
        {event ? (
          <SubmitButton pendingText="Saving…">Save changes</SubmitButton>
        ) : (
          <SubmitButton pendingText="Creating…">Create meetup</SubmitButton>
        )}
        {event && state?.ok && <span className="text-sm text-muted">Saved.</span>}
      </div>
    </form>
  );
}

export function CampaignForm({ causeId, defaultTarget }: { causeId: string; defaultTarget?: string }) {
  const [state, action] = useFormAction(createCampaign);
  const e = state?.fieldErrors;
  const v = state?.values;
  if (state?.ok) return <p className="text-sm text-link">Campaign started — share it with your neighbours!</p>;
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="causeId" value={causeId} />
      <FormError message={state?.error} />
      <Field label="Who can fix this?" name="target" errors={e} hint="A specific decision-maker: city council, school board, landlord, transit agency…">
        <input name="target" required placeholder="City Council — Ward 4" defaultValue={v?.target ?? defaultTarget} className={inputStyles} />
      </Field>
      <Field label="What exactly are you asking for?" name="ask" errors={e} hint="Concrete asks win: “Install a signalized crosswalk at Elm & 5th before next school year.”">
        <textarea name="ask" required rows={4} defaultValue={v?.ask} className={inputStyles} />
      </Field>
      <Field label="Signature goal" name="goal" errors={e}>
        <input name="goal" type="number" min={5} defaultValue={v?.goal ?? 100} className={`${inputStyles} w-32`} />
      </Field>
      <Honeypot />
      <SubmitButton pendingText="Starting…">Start campaign</SubmitButton>
    </form>
  );
}

export function SignForm({ campaignId, signed }: { campaignId: string; signed: boolean }) {
  const [state, action] = useFormAction(signCampaign);
  if (signed || state?.ok) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <p className="font-medium text-link">✓ You&apos;ve signed this campaign</p>
        <form action={unsignCampaign}>
          <input type="hidden" name="campaignId" value={campaignId} />
          <button className="text-xs text-muted underline hover:text-foreground">Remove my signature</button>
        </form>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="campaignId" value={campaignId} />
      <FormError message={state?.error} />
      <input
        name="note"
        maxLength={500}
        placeholder="Why this matters to you (optional, shown publicly)"
        defaultValue={state?.values?.note}
        className={inputStyles}
        aria-label="Why this matters to you"
      />
      <SubmitButton pendingText="Signing…">Add my name</SubmitButton>
      <p className="text-xs text-muted">
        Your name and rough area (like M5V, from your home area) go on the petition the organizers deliver, with your note if you add one.
        Never your email.
      </p>
    </form>
  );
}

export function LetterBuilder({
  causeTitle,
  causeUrl,
  ask,
  target,
  signatures,
  place,
}: {
  causeTitle: string;
  causeUrl: string;
  ask: string;
  target: string;
  signatures: number;
  place: string;
}) {
  const [name, setName] = useState("");
  const [to, setTo] = useState("");
  const [copied, setCopied] = useState(false);
  const subject = `Constituent request: ${causeTitle}`;
  const body = `Dear ${target},

I'm writing as a resident of ${place} about an issue affecting our community: ${causeTitle}.

${ask}

${signatures > 1 ? `${signatures} neighbours have signed on in support of this request. ` : ""}You can read the details and our community's discussion here: ${causeUrl}

I would appreciate a response letting us know what steps you can take.

Sincerely,
${name || "[Your name]"}`;

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" aria-label="Your name" className={inputStyles} />
        <input value={to} onChange={(e) => setTo(e.target.value)} type="email" placeholder="Their email (if you have it)" aria-label="Recipient email" className={inputStyles} />
      </div>
      <textarea readOnly value={body} rows={12} className={`${inputStyles} font-mono text-xs`} aria-label="Letter preview" />
      <div className="flex flex-wrap gap-2">
        <a
          className={buttonStyles.primary}
          href={`mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`}
        >
          Open in email
        </a>
        <button
          type="button"
          className={buttonStyles.secondary}
          onClick={async () => {
            await navigator.clipboard.writeText(body);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          {copied ? "Copied!" : "Copy letter"}
        </button>
      </div>
    </div>
  );
}

export function ShareButton({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={buttonStyles.secondary}
      onClick={async () => {
        if (navigator.share) {
          try {
            await navigator.share({ title, url });
            return;
          } catch {
            // Cancelled or unsupported — fall back to copying.
          }
        }
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? "Link copied" : "Share"}
    </button>
  );
}

type Rep = { name: string; elected_office: string; district_name: string; email?: string; url?: string; party_name?: string };

export function RepLookup({ country }: { country: string }) {
  const [postal, setPostal] = useState("");
  const [reps, setReps] = useState<Rep[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (country !== "CA") {
    return (
      <p className="text-sm text-muted">
        Look up your federal, state and local officials at{" "}
        <a href="https://www.usa.gov/elected-officials" target="_blank" rel="noopener noreferrer" className="font-medium text-link underline">
          usa.gov/elected-officials
        </a>
        . Then, under <strong>The ask</strong>, use <strong>✉️ Write to…</strong> and add their email to the letter (start a campaign first if there isn&apos;t one).
      </p>
    );
  }

  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
          const res = await fetch(`/api/representatives?postal=${encodeURIComponent(postal)}`);
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? "Lookup failed");
          setReps(data.representatives);
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setLoading(false);
        }
      }}
    >
      <p className="text-sm text-muted">Enter your full postal code to find your MP, MPP/MLA and councillor. It isn&apos;t saved.</p>
      <div className="flex gap-2">
        <input value={postal} onChange={(e) => setPostal(e.target.value)} placeholder="M5V 2T6" aria-label="Full postal code" className={inputStyles} />
        <button className={buttonStyles.secondary} disabled={loading}>
          {loading ? "Finding…" : "Find"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {reps && (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {reps.length === 0 && <li className="p-3 text-sm text-muted">No representatives found.</li>}
          {reps.map((r) => (
            <li key={`${r.elected_office}-${r.name}`} className="p-3 text-sm">
              <p className="font-medium">{r.name}</p>
              <p className="text-muted">
                {r.elected_office} · {r.district_name}
                {r.party_name ? ` · ${r.party_name}` : ""}
              </p>
              {r.email && (
                <button type="button" className="mt-1 text-link underline" onClick={() => navigator.clipboard.writeText(r.email!)}>
                  Copy email ({r.email})
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
