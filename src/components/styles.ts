// Shared class strings. Kept out of "use client" files so Server Components
// can import them as plain strings.

const base =
  "inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed";

export const buttonStyles = {
  // The one loud button on a screen: action red.
  primary: `${base} bg-brand text-white hover:bg-brand-strong`,
  // Everything else: inked outline on paper.
  secondary: `${base} border-[1.5px] border-ink bg-surface hover:bg-background`,
  ghost: `${base} hover:bg-surface`,
  // Something you've already done (I care, Going, Hosting): solid ink, not red.
  selected: `${base} border-[1.5px] border-ink bg-ink text-background hover:opacity-90`,
};

export const inputStyles =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm placeholder:text-muted/70 focus:border-ink focus:outline-none";
