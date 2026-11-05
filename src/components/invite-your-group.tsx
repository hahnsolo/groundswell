"use client";

import { useState } from "react";
import {
  batches,
  contactsFromRows,
  EMAIL_BATCH,
  emailLink,
  inviteMessage,
  parseCsv,
  personalize,
  showPhone,
  textLink,
  whatsappLink,
  type Contact,
} from "@/lib/contacts";
import { buttonStyles } from "./styles";

// Bring your group over (#68): the leader's own invite link, a ready-written
// message for WhatsApp, texts and email, and their own contact list. The list
// is read right here in the browser and never leaves this device: Groundswell
// doesn't upload, store, email or text it. Messages go from their own apps.

const MAX_FILE = 5 * 1024 * 1024;
const small = `${buttonStyles.secondary} !px-2.5 !py-1 text-xs`;

/** Which numbers they've already messaged, kept on this device only so ticks survive a reload. */
function useSentTicks(causeId: string) {
  const key = `gs_invited_${causeId}`;
  // Only shown once a list is chosen (never in the first render), so reading storage here can't cause a mismatch.
  const [sent, setSent] = useState<Set<string>>(() => {
    try {
      return new Set(typeof window === "undefined" ? [] : JSON.parse(localStorage.getItem(key) ?? "[]"));
    } catch {
      return new Set(); // No storage (private window): ticks just won't survive a reload.
    }
  });
  const toggle = (phone: string, on: boolean) =>
    setSent((prev) => {
      const next = new Set(prev);
      if (on) next.add(phone);
      else next.delete(phone);
      try {
        localStorage.setItem(key, JSON.stringify([...next]));
      } catch {
        // Ignore.
      }
      return next;
    });
  return { sent, toggle };
}

async function readContacts(file: File) {
  if (file.size > MAX_FILE) throw new Error("That file is over 5 MB. Try exporting just names, emails and phone numbers.");
  const name = file.name.toLowerCase();
  if (name.endsWith(".xls")) throw new Error("That's an older Excel file. Save it as .xlsx or .csv first, then try again.");
  if (name.endsWith(".xlsx")) {
    const { readXlsxRows } = await import("@/lib/xlsx");
    return contactsFromRows(readXlsxRows(new Uint8Array(await file.arrayBuffer())));
  }
  return contactsFromRows(parseCsv(await file.text()));
}

export function InviteYourGroup({
  causeId,
  title,
  place,
  inviteLink,
  joined,
}: {
  causeId: string;
  title: string;
  place: string;
  inviteLink: string;
  joined: number;
}) {
  const [message, setMessage] = useState(() => inviteMessage(title, place, inviteLink));
  const [copied, setCopied] = useState<string | null>(null);
  const [list, setList] = useState<{ file: string; contacts: Contact[]; skipped: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { sent, toggle } = useSentTicks(causeId);
  const subject = `Join us: ${title}`;
  const hasLink = message.includes(inviteLink);

  const copy = async (what: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(what);
    setTimeout(() => setCopied(null), 2000);
  };

  const emails = list?.contacts.filter((c) => c.email).map((c) => c.email!) ?? [];
  const phones = list?.contacts.filter((c) => c.phone) ?? [];

  return (
    <div className="space-y-5 text-sm">
      <div className="space-y-2">
        <p className="font-medium">Your invite link</p>
        <div className="flex flex-wrap items-center gap-2">
          <code className="min-w-0 break-all rounded bg-surface px-2 py-1 text-xs">{inviteLink}</code>
          <button type="button" className={small} onClick={() => copy("link", inviteLink)}>
            {copied === "link" ? "Copied" : "Copy"}
          </button>
        </div>
        <p className="text-muted" data-testid="invite-count">
          {joined === 0 ? "Nobody has joined from your invite yet." : `${joined} ${joined === 1 ? "person has" : "people have"} joined from your invite.`}
        </p>
      </div>

      <div className="space-y-2 border-t border-border pt-4">
        <label htmlFor="invite-message" className="block font-medium">
          The message
        </label>
        <textarea
          id="invite-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={5}
          maxLength={1000}
          className="w-full rounded-md border border-border bg-surface p-2 text-sm"
        />
        {!hasLink && <p className="text-xs text-red-700 dark:text-red-400">Your link isn&apos;t in the message any more, so people won&apos;t be counted as from your invite.</p>}
        <div className="flex flex-wrap gap-2">
          <a href={whatsappLink(message)} target="_blank" rel="noopener" className={small}>
            Share to WhatsApp
          </a>
          <a href={textLink(message)} className={small}>
            Text
          </a>
          <a href={emailLink({ subject, body: message })} className={small}>
            Email
          </a>
          <button type="button" className={`${buttonStyles.ghost} !px-2.5 !py-1 text-xs underline`} onClick={() => copy("message", message)}>
            {copied === "message" ? "Message copied" : "Copy the message"}
          </button>
        </div>
        <p className="text-xs text-muted">Each opens your own app with the message ready, so you can change it before sending. Paste into a WhatsApp group to invite everyone at once.</p>
      </div>

      <div className="space-y-3 border-t border-border pt-4">
        <p className="font-medium">Use my contact list</p>
        <p className="text-muted">
          A spreadsheet (Excel .xlsx or .csv) of names with emails and/or phone numbers, like an export from your phone, Google
          Contacts or a sign-up sheet. <strong className="text-foreground">It&apos;s read on this device only:</strong> it&apos;s never sent to
          Groundswell or stored, and Groundswell never emails or texts the people on it. You send the messages yourself.
        </p>
        <input
          type="file"
          accept=".csv,.xlsx,.txt,text/csv"
          aria-label="Choose a contact list spreadsheet"
          className="block w-full max-w-sm text-xs file:mr-3 file:rounded-md file:border file:border-border file:bg-surface file:px-3 file:py-1.5"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            setError(null);
            try {
              const result = await readContacts(file);
              if (result.contacts.length === 0) setError("We couldn't find any emails or phone numbers in that file. Check it has columns like Name, Email and Phone.");
              setList({ file: file.name, ...result });
            } catch (err) {
              setList(null);
              setError(err instanceof Error && err.message.length < 200 ? err.message : "We couldn't read that file. Try saving it as .csv.");
            }
          }}
        />
        {error && (
          <p role="alert" className="text-red-700 dark:text-red-400">
            {error}
          </p>
        )}

        {list && list.contacts.length > 0 && (
          <div className="space-y-4" aria-label="Your contacts">
            <p role="status" className="flex flex-wrap items-center gap-2 text-muted">
              <span>
                {list.file}: {list.contacts.length} {list.contacts.length === 1 ? "person" : "people"} ({emails.length} with email, {phones.length} with a phone
                number){list.skipped > 0 ? `; ${list.skipped} rows had neither` : ""}.
              </span>
              <button type="button" className="text-xs underline hover:text-foreground" onClick={() => setList(null)}>
                Clear the list
              </button>
            </p>

            {emails.length > 0 && (
              <div className="space-y-2">
                <p className="font-medium">Email ({emails.length})</p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={small} onClick={() => copy("emails", emails.join(", "))}>
                    {copied === "emails" ? "Addresses copied" : "Copy all addresses"}
                  </button>
                  {batches(emails).map((group, i, all) => (
                    <a key={i} href={emailLink({ subject, body: message, bcc: group })} className={small}>
                      Open in my email{all.length > 1 ? ` (${i * EMAIL_BATCH + 1}–${i * EMAIL_BATCH + group.length})` : ""}
                    </a>
                  ))}
                </div>
                <p className="text-xs text-muted">Addresses go in BCC, so nobody sees the others&apos;.</p>
              </div>
            )}

            {phones.length > 0 && (
              <div className="space-y-2">
                <p className="font-medium">
                  Phone ({sent.size > 0 ? `${phones.filter((c) => sent.has(c.phone!)).length} of ${phones.length} sent` : phones.length})
                </p>
                <ul className="divide-y divide-border rounded-md border border-border">
                  {phones.map((c) => {
                    const text = personalize(message, c.name);
                    const done = sent.has(c.phone!);
                    return (
                      <li key={c.phone} className="flex flex-wrap items-center gap-x-3 gap-y-2 p-2">
                        <label className="flex min-w-0 flex-1 items-center gap-2">
                          <input type="checkbox" checked={done} onChange={(e) => toggle(c.phone!, e.target.checked)} aria-label={`Sent to ${c.name || showPhone(c.phone!)}`} />
                          <span className={`min-w-0 ${done ? "text-muted line-through" : ""}`}>
                            <span className="block truncate">{c.name || "No name"}</span>
                            <span className="block text-xs text-muted">{showPhone(c.phone!)}</span>
                          </span>
                        </label>
                        <span className="flex gap-2">
                          <a href={whatsappLink(text, c.phone)} target="_blank" rel="noopener" className={small} onClick={() => toggle(c.phone!, true)}>
                            WhatsApp
                          </a>
                          <a href={textLink(text, c.phone)} className={small} onClick={() => toggle(c.phone!, true)}>
                            Text
                          </a>
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <p className="text-xs text-muted">Ticks are kept on this device so you can pick up where you left off.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
