// Shared class strings. Kept out of "use client" files so Server Components
// can import them as plain strings.

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed";

export const buttonStyles = {
  primary: `${base} bg-brand text-white hover:bg-brand-strong`,
  secondary: `${base} border border-border bg-surface hover:bg-brand-soft`,
  ghost: `${base} hover:bg-brand-soft`,
};

export const inputStyles =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm placeholder:text-muted/70 focus:border-brand focus:outline-none";
