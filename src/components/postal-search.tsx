"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { COUNTRIES, areaHref, getCountry, parsePostal } from "@/lib/countries";
import { buttonStyles, inputStyles } from "./ui";

export function PostalSearch({
  defaultCountry = "US",
  defaultPostal = "",
  compact = false,
}: {
  defaultCountry?: string;
  defaultPostal?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [country, setCountry] = useState(defaultCountry);
  const [postal, setPostal] = useState(defaultPostal);
  const [error, setError] = useState<string | null>(null);
  const config = getCountry(country)!;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parsePostal(country, postal);
    if (!parsed.ok) return setError(parsed.error);
    setError(null);
    router.push(areaHref(parsed.country.code, parsed.postal));
  }

  return (
    <form onSubmit={onSubmit} className="w-full">
      <div className={`flex flex-col gap-2 sm:flex-row ${compact ? "" : "rounded-2xl bg-surface p-2 shadow-sm ring-1 ring-border"}`}>
        <select
          aria-label="Country"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          className={`${inputStyles} sm:w-44 ${compact ? "" : "border-transparent"}`}
        >
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
        <input
          aria-label={config.postalLabel}
          aria-invalid={!!error}
          value={postal}
          onChange={(e) => setPostal(e.target.value)}
          placeholder={`${config.postalLabel} — ${config.placeholder}`}
          autoComplete="postal-code"
          className={`${inputStyles} flex-1 ${compact ? "" : "border-transparent text-base"}`}
        />
        <button type="submit" className={`${buttonStyles.primary} ${compact ? "" : "px-6 text-base"}`}>
          Find my community
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </form>
  );
}
