"use client";

import { removeFromCause } from "@/app/actions/leader-moderation";
import { Field, FormError, SubmitButton, inputStyles, useFormAction } from "./ui";

/** "Remove from this cause" (#71): asks why, because the person is told. */
export function RemoveMemberForm({ causeId, userId, name, onCancel }: { causeId: string; userId: string; name: string; onCancel?: () => void }) {
  const [state, action] = useFormAction(removeFromCause);
  return (
    <form action={action} className="w-full min-w-56 max-w-md space-y-2 text-left text-sm">
      <input type="hidden" name="causeId" value={causeId} />
      <input type="hidden" name="userId" value={userId} />
      <p className="text-muted">
        {name} leaves this cause and can&apos;t rejoin it. Their signatures and RSVPs go with them; their messages stay. They&apos;re told why, and moderators can see this and undo it.
      </p>
      <FormError message={state?.error} />
      <Field label="Why? (they'll see this)" name="reason" errors={state?.fieldErrors}>
        <input name="reason" required minLength={3} maxLength={300} placeholder="Repeated spam after being asked to stop." defaultValue={state?.values?.reason} className={inputStyles} />
      </Field>
      <div className="flex items-center gap-2">
        <SubmitButton variant="secondary" pendingText="Removing…" className="!px-3 !py-1 text-xs">
          Remove from this cause
        </SubmitButton>
        {onCancel && (
          <button type="button" onClick={onCancel} className="text-xs text-muted underline hover:text-foreground">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
