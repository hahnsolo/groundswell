"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset, resendVerification, resetPassword } from "@/app/actions/auth";
import { Field, FormError, SubmitButton, inputStyles, useFormAction } from "./ui";

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
      <SubmitButton className="w-full" pendingText="Sending…">
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
