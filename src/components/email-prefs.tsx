"use client";

import { saveEmailPrefs } from "@/app/actions/notifications";
import { NOTIFY_KIND_IDS, NOTIFY_KINDS, type NotifyPrefs } from "@/lib/notify-rules";
import { SubmitButton, useFormAction } from "./ui";

/** Which kinds of notifications to get (#18, #95), in your list and by push. */
export function EmailPrefsForm({ prefs }: { prefs: NotifyPrefs }) {
  const [state, action] = useFormAction(saveEmailPrefs);
  return (
    // Keyed on the saved settings, so the boxes show what's saved after the form resets.
    <form key={JSON.stringify(prefs)} action={action} className="space-y-3">
      <ul className="space-y-2">
        {NOTIFY_KIND_IDS.map((k) => {
          const { pref, label, hint } = NOTIFY_KINDS[k];
          return (
            <li key={k}>
              <label className="flex items-start gap-2.5 text-sm">
                <input type="checkbox" name={pref} defaultChecked={prefs[pref]} className="mt-0.5 h-4 w-4 accent-brand" />
                <span>
                  <span className="font-medium">{label}</span>
                  <span className="block text-muted">{hint}</span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted">Requests to lead or co-lead a cause always reach you. We only email you to confirm your address or reset your password.</p>
      <div className="flex items-center gap-3">
        <SubmitButton variant="secondary" pendingText="Saving…">
          Save notification settings
        </SubmitButton>
        {state?.ok && <span role="status" className="text-sm text-muted">Saved.</span>}
      </div>
    </form>
  );
}
