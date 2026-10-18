"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signIn, signUp } from "@/app/actions/auth";
import { COUNTRIES } from "@/lib/countries";
import { Field, FormError, SubmitButton, inputStyles } from "./ui";

export function SignInForm({ next }: { next?: string }) {
  const [state, action] = useActionState(signIn, null);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next ?? "/"} />
      <FormError message={state?.error} />
      <Field label="Email" name="email" errors={state?.fieldErrors}>
        <input name="email" type="email" autoComplete="email" required className={inputStyles} />
      </Field>
      <Field label="Password" name="password" errors={state?.fieldErrors}>
        <input name="password" type="password" autoComplete="current-password" required className={inputStyles} />
      </Field>
      <p className="-mt-2 text-right text-sm">
        <Link href="/forgot-password" className="text-muted underline hover:text-foreground">
          Forgot password?
        </Link>
      </p>
      <SubmitButton className="w-full" pendingText="Signing in…">
        Sign in
      </SubmitButton>
      <p className="text-center text-sm text-muted">
        New here?{" "}
        <Link href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"} className="font-medium text-brand-strong underline dark:text-brand">
          Create an account
        </Link>
      </p>
    </form>
  );
}

export function SignUpForm({ next }: { next?: string }) {
  const [state, action] = useActionState(signUp, null);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next ?? "/"} />
      <FormError message={state?.error} />
      <Field label="Name" name="name" errors={state?.fieldErrors} hint="Shown next to what you post. First name is fine.">
        <input name="name" autoComplete="given-name" required className={inputStyles} />
      </Field>
      <Field label="Email" name="email" errors={state?.fieldErrors}>
        <input name="email" type="email" autoComplete="email" required className={inputStyles} />
      </Field>
      <Field label="Password" name="password" errors={state?.fieldErrors} hint="At least 10 characters.">
        <input name="password" type="password" autoComplete="new-password" minLength={10} required className={inputStyles} />
      </Field>
      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium">Home area (optional)</legend>
        <div className="flex gap-2">
          <select name="country" aria-label="Country" className={`${inputStyles} w-40`} defaultValue="US">
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
          <input name="postal" aria-label="Postal or ZIP code" placeholder="Postal / ZIP code" autoComplete="postal-code" className={inputStyles} />
        </div>
        {state?.fieldErrors?.postal?.[0] && <p className="text-sm text-red-600 dark:text-red-400">{state.fieldErrors.postal[0]}</p>}
      </fieldset>
      <SubmitButton className="w-full" pendingText="Creating account…">
        Create account
      </SubmitButton>
      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href={next ? `/signin?next=${encodeURIComponent(next)}` : "/signin"} className="font-medium text-brand-strong underline dark:text-brand">
          Sign in
        </Link>
      </p>
    </form>
  );
}
