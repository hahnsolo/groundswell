"use client";

import Link from "next/link";
import { useActionState } from "react";
import { deleteAccount, requestPasswordReset, resendVerification, resetPassword } from "@/app/actions/auth";
import { Field, FormError, SubmitButton, inputStyles, useFormAction } from "./ui";
import { useBotCheck } from "./bot-check";

export function ResendVerificationButton() {
  const [state, action] = useActionState(resendVerification, null);
  if (state?.ok) return <span className="font-medium">Sent — check your inbox.</span>;
  return (
    <form action={action} className="inline">
      <button className="font-medium underline">Resend the link</button>
      {state?.error && <span className="ml-2">{state.error}</span>}
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useFormAction(requestPasswordReset);
  const bot = useBotCheck(state);
  if (state?.ok) {
    return (
      <p className="rounded-lg bg-brand-soft p-4 text-sm">
        If there&apos;s an account for that email, a reset link is on its way. It expires in 1 hour.
      </p>
    );
  }
  return (
    <form action={action} className="space-y-4">
      <FormError message={state?.error} />
      <Field label="Email" name="email" errors={state?.fieldErrors}>
        <input name="email" type="email" autoComplete="email" required defaultValue={state?.values?.email} className={inputStyles} />
      </Field>
      {bot.widget}
      <SubmitButton className="w-full" pendingText="Sending…" waitingFor={bot.passed ? undefined : "Checking you're human…"}>
        Send reset link
      </SubmitButton>
      <p className="text-center text-sm text-muted">
        <Link href="/signin" className="underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}

export function DeleteAccountForm({ hasPassword, graceDays }: { hasPassword: boolean; graceDays: number }) {
  const [state, action] = useFormAction(deleteAccount);
  return (
    <details className="group">
      <summary className="cursor-pointer text-sm font-medium text-red-700 dark:text-red-400">Delete my account…</summary>
      <div className="mt-4 space-y-4 text-sm">
        <ul className="list-disc space-y-1 pl-5 text-muted">
          <li>You&apos;ll be signed out on every device.</li>
          <li>Causes and messages you posted stay up, credited to &ldquo;Former member&rdquo;.</li>
          <li>Your campaign signatures and upcoming RSVPs are removed. Meetups you&apos;re hosting pass to the next person going, or are cancelled.</li>
          <li>
            Sign in within <strong className="text-foreground">{graceDays} days</strong> to undo this. After that your name, email and password
            are erased for good.
          </li>
        </ul>
        <form action={action} className="space-y-3">
          <FormError message={state?.error} />
          {hasPassword ? (
            <Field label="Your password" name="password" errors={state?.fieldErrors}>
              <input name="password" type="password" autoComplete="current-password" required className={inputStyles} />
            </Field>
          ) : (
            <Field label="Type DELETE to confirm" name="confirm" errors={state?.fieldErrors}>
              <input name="confirm" required autoComplete="off" className={inputStyles} />
            </Field>
          )}
          <SubmitButton variant="secondary" pendingText="Deleting…" className="text-red-700 dark:text-red-400">
            Delete my account
          </SubmitButton>
        </form>
      </div>
    </details>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action] = useActionState(resetPassword, null);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <FormError message={state?.error} />
      <Field label="New password" name="password" errors={state?.fieldErrors} hint="At least 10 characters.">
        <input name="password" type="password" autoComplete="new-password" minLength={10} required className={inputStyles} />
      </Field>
      <Field label="Confirm new password" name="confirm" errors={state?.fieldErrors}>
        <input name="confirm" type="password" autoComplete="new-password" required className={inputStyles} />
      </Field>
      <SubmitButton className="w-full" pendingText="Saving…">
        Set new password
      </SubmitButton>
    </form>
  );
}
