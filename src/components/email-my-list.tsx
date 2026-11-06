"use client";

import { useState } from "react";
import { batches, EMAIL_BATCH, emailLink, updateMessage } from "@/lib/contacts";
import { readContactFile } from "./invite-your-group";
import { inputStyles } from "./ui";
import { buttonStyles } from "./styles";

// "Email my list an update" (#95): opens the host's own email app with a
// message ready. Groundswell doesn't send it. Their contact list, if they add
// one, is read on this device only, and members' emails are never involved.

const small = `${buttonStyles.secondary} !px-2.5 !py-1 text-xs`;

export function EmailMyList({ title, link }: { title: string; link: string }) {
  const [message, setMessage] = useState(() => updateMessage(title, link));
  const [emails, setEmails] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const subject = `Update: ${title}`;
  const groups = batches(emails);

  return (
    <div className="space-y-3 text-sm">
      <p className="text-muted">
        This opens <strong className="text-foreground">your own email app</strong> with the message ready, and you send it yourself. For the people going, post in the chat or use an announcement: member emails are never shared.
      </p>
      <label className="block">
        <span className="mb-1 block font-medium">The message</span>
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} maxLength={1000} className={inputStyles} />
      </label>
      <label className="block">
        <span className="mb-1 block font-medium">Your list (optional)</span>
        <span className="mb-1 block text-xs text-muted">A spreadsheet (.xlsx or .csv) with email addresses. It&apos;s read on this device only: never sent to Groundswell or stored.</span>
        <input
          type="file"
          accept=".csv,.xlsx,.txt,text/csv"
          className="block w-full max-w-sm text-xs file:mr-3 file:rounded-md file:border file:border-border file:bg-surface file:px-3 file:py-1.5"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            setError(null);
            try {
              const found = (await readContactFile(file)).contacts.flatMap((c) => (c.email ? [c.email] : []));
              if (found.length === 0) setError("We couldn't find any email addresses in that file.");
              setEmails(found);
            } catch (err) {
              setEmails([]);
              setError(err instanceof Error && err.message.length < 200 ? err.message : "We couldn't read that file. Try saving it as .csv.");
            }
          }}
        />
      </label>
      {error && (
        <p role="alert" className="text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
      {emails.length > 0 && <p role="status" className="text-muted">{emails.length} {emails.length === 1 ? "address" : "addresses"} from your list, in BCC so nobody sees the others&apos;.</p>}
      <div className="flex flex-wrap gap-2">
        {groups.length === 0 ? (
          <a href={emailLink({ subject, body: message })} className={small}>
            Open in my email
          </a>
        ) : (
          groups.map((group, i) => (
            <a key={i} href={emailLink({ subject, body: message, bcc: group })} className={small}>
              Open in my email{groups.length > 1 ? ` (${i * EMAIL_BATCH + 1}–${i * EMAIL_BATCH + group.length})` : ""}
            </a>
          ))
        )}
      </div>
    </div>
  );
}
