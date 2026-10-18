"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { ComponentProps, ReactNode } from "react";
import type { FormState } from "@/lib/forms";
import { buttonStyles, inputStyles } from "./styles";

export { buttonStyles, inputStyles };

/**
 * useActionState for our Server Actions, plus: when the action returns an
 * error, the submitted values come back in `state.values`. React clears a form
 * after every action, so inputs use `defaultValue={state?.values?.x}` to keep
 * what the person typed. Passwords are never echoed.
 */
export function useFormAction(action: (prev: FormState, formData: FormData) => Promise<FormState>) {
  return useActionState(async (prev: FormState, formData: FormData): Promise<FormState> => {
    const result = await action(prev, formData);
    if (!result || result.ok) return result;
    const values: Record<string, string> = {};
    formData.forEach((v, k) => {
      if (typeof v === "string" && !/password|confirm/i.test(k)) values[k] = v;
    });
    return { ...result, values };
  }, null);
}

export function SubmitButton({
  children,
  pendingText,
  variant = "primary",
  className = "",
  ...rest
}: ComponentProps<"button"> & { pendingText?: string; variant?: keyof typeof buttonStyles }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`${buttonStyles[variant]} ${className}`} {...rest}>
      {pending ? (pendingText ?? "Saving…") : children}
    </button>
  );
}

export function Field({
  label,
  name,
  errors,
  hint,
  children,
}: {
  label: string;
  name: string;
  errors?: Record<string, string[] | undefined>;
  hint?: string;
  children: ReactNode;
}) {
  const err = errors?.[name]?.[0];
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {err ? (
        <span className="block text-sm text-red-600 dark:text-red-400">{err}</span>
      ) : hint ? (
        <span className="block text-xs text-muted">{hint}</span>
      ) : null}
    </label>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
      {message}
    </p>
  );
}
