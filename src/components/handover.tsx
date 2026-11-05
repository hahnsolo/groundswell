"use client";

import { inviteCoLeader, offerLead } from "@/app/actions/community";
import { FormError, SubmitButton, inputStyles, useFormAction } from "./ui";

/** The leader picks a member to offer the lead to. */
export function HandOverForm({ causeId, members }: { causeId: string; members: { id: string; name: string }[] }) {
  const [state, action] = useFormAction(offerLead);
  if (members.length === 0) {
    return <p className="text-muted">Once other neighbours join, you can hand this cause to one of them.</p>;
  }
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="causeId" value={causeId} />
      <p className="text-muted">
        They&apos;ll get an email and a note on the cause, and have 7 days to accept. You stay on as a member.
      </p>
      <FormError message={state?.error} />
      <div className="flex flex-wrap items-center gap-2">
        <select name="toUserId" required defaultValue="" aria-label="Who should take over" className={`${inputStyles} sm:w-64`}>
          <option value="" disabled>
            Choose a member…
          </option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <SubmitButton variant="secondary" pendingText="Sending…">
          Offer the lead
        </SubmitButton>
      </div>
    </form>
  );
}

/** The leader invites a member to co-lead (#42). */
export function CoLeaderInviteForm({ causeId, members }: { causeId: string; members: { id: string; name: string }[] }) {
  const [state, action] = useFormAction(inviteCoLeader);
  if (members.length === 0) {
    return <p className="text-muted">Once other neighbours join, you can invite one of them to co-lead.</p>;
  }
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="causeId" value={causeId} />
      <FormError message={state?.error} />
      <div className="flex flex-wrap items-center gap-2">
        <select name="toUserId" required defaultValue="" aria-label="Who to invite to co-lead" className={`${inputStyles} sm:w-64`}>
          <option value="" disabled>
            Choose a member…
          </option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <SubmitButton variant="secondary" pendingText="Sending…">
          Invite to co-lead
        </SubmitButton>
      </div>
    </form>
  );
}
