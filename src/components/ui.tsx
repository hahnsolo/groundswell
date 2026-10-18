"use client";

import { useFormStatus } from "react-dom";
import type { ComponentProps, ReactNode } from "react";
import { buttonStyles, inputStyles } from "./styles";

export { buttonStyles, inputStyles };

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
