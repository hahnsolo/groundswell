"use client";

import { useState } from "react";
import { addComment, createCampaign, createMeetup, signCampaign, unsignCampaign } from "@/app/actions/community";
import { Field, FormError, SubmitButton, buttonStyles, inputStyles, useFormAction } from "./ui";
import { Honeypot } from "./bot-check";

export function CommentForm({ issueId }: { issueId: string }) {
  // On success React clears the box; on error the text comes back via state.values.
  const [state, action] = useFormAction(addComment);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="issueId" value={issueId} />
      <FormError message={state?.error} />
      <textarea
        name="body"
        required
        rows={3}
        maxLength={3000}
        placeholder="Share what you've seen, ask a question, or offer to help…"
        defaultValue={state?.values?.body}
        className={inputStyles}
        aria-label="Your comment"
      />
      {state?.fieldErrors?.body?.[0] && <p className="text-sm text-red-600">{state.fieldErrors.body[0]}</p>}
      <Honeypot />
      <SubmitButton pendingText="Posting…">Post comment</SubmitButton>
    </form>
  );
}

function toLocalInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function MeetupForm({ issueId }: { issueId: string }) {
  const [state, action] = useFormAction(createMeetup);
  const [local, setLocal] = useState("");
  const [online, setOnline] = useState(false);
  // Lazy init: computed once in the browser's timezone; the server re-validates.
  const [min] = useState(() => toLocalInputValue(new Date()));
  const e = state?.fieldErrors;
  const v = state?.values;
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="issueId" value={issueId} />
      {/* Send an unambiguous UTC timestamp; the picker is in the organizer's own timezone. */}
      <input type="hidden" name="startsAt" value={local ? new Date(local).toISOString() : ""} />
      <FormError message={state?.error} />
      <Field label="Title" name="title" errors={e}>
        <input name="title" required placeholder="Neighbourhood walk-through" defaultValue={v?.title} className={inputStyles} />
      </Field>
      <Field label="When" name="startsAt" errors={e}>
        <input type="datetime-local" required min={min} suppressHydrationWarning value={local} onChange={(ev) => setLocal(ev.target.value)} className={inputStyles} />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isOnline" checked={online} onChange={(ev) => setOnline(ev.target.checked)} />
        Online meetup
      </label>
      <Field label={online ? "Video link" : "Where"} name="location" errors={e} hint={online ? undefined : "A public place — library, café, park entrance."}>
        <input
          name="location"
          required
          placeholder={online ? "https://meet…" : "Central Library, room 2"}
          defaultValue={v?.location}
          className={inputStyles}
        />
      </Field>
      <Field label="What's the plan? (optional)" name="description" errors={e}>
        <textarea name="description" rows={3} defaultValue={v?.description} className={inputStyles} />
      </Field>
      <Field label="Capacity (optional)" name="capacity" errors={e}>
        <input name="capacity" type="number" min={2} defaultValue={v?.capacity} className={`${inputStyles} w-32`} />
      </Field>
      <Honeypot />
      <SubmitButton pendingText="Creating…">Create meetup</SubmitButton>
    </form>
  );
}

export function CampaignForm({ issueId }: { issueId: string }) {
  const [state, action] = useFormAction(createCampaign);
  const e = state?.fieldErrors;
  const v = state?.values;
  if (state?.ok) return <p className="text-sm text-link">Campaign started — share it with your neighbours!</p>;
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="issueId" value={issueId} />
      <FormError message={state?.error} />
      <Field label="Who can fix this?" name="target" errors={e} hint="A specific decision-maker: city council, school board, landlord, transit agency…">
        <input name="target" required placeholder="City Council — Ward 4" defaultValue={v?.target} className={inputStyles} />
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
    </form>
  );
}

export function LetterBuilder({
  issueTitle,
  issueUrl,
  ask,
  target,
  signatures,
  place,
}: {
  issueTitle: string;
  issueUrl: string;
  ask: string;
  target: string;
  signatures: number;
  place: string;
}) {
  const [name, setName] = useState("");
  const [to, setTo] = useState("");
  const [copied, setCopied] = useState(false);
  const subject = `Constituent request: ${issueTitle}`;
  const body = `Dear ${target},

I'm writing as a resident of ${place} about an issue affecting our community: ${issueTitle}.

${ask}

${signatures > 1 ? `${signatures} neighbours have signed on in support of this request. ` : ""}You can read the details and our community's discussion here: ${issueUrl}

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
        , then paste their email into the letter above.
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
