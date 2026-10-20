"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { COUNTRIES, areaHref, getCountry, parsePostal } from "@/lib/countries";
import { buttonStyles, inputStyles } from "./ui";

/**
 * Country + postal code → the area page.
 *  - default: the big search box on the home page
 *  - compact: plain inputs in a row (a column on phones)
 *  - stacked: for narrow spots like the header's neighbourhood panel — country
 *    and code share a row, the button sits underneath at full width
 */
export function PostalSearch({
  defaultCountry = "US",
  defaultPostal = "",
  compact = false,
  stacked = false,
}: {
  defaultCountry?: string;
  defaultPostal?: string;
  compact?: boolean;
  stacked?: boolean;
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

  const plain = compact || stacked;
  const countrySelect = (
    <select
      aria-label="Country"
      value={country}
      onChange={(e) => setCountry(e.target.value)}
      className={`${inputStyles} ${stacked ? "!w-36 shrink-0" : "sm:w-44"} ${plain ? "" : "border-transparent"}`}
    >
      {COUNTRIES.map((c) => (
        <option key={c.code} value={c.code}>
          {c.name}
        </option>
      ))}
    </select>
  );
  const codeInput = (
    <input
      aria-label={config.postalLabel}
      aria-invalid={!!error}
      value={postal}
      onChange={(e) => setPostal(e.target.value)}
      placeholder={stacked ? config.placeholder : `${config.postalLabel} — ${config.placeholder}`}
      autoComplete="postal-code"
      className={`${inputStyles} min-w-0 flex-1 ${plain ? "" : "border-transparent text-base"}`}
    />
  );

  return (
    <form onSubmit={onSubmit} className="w-full">
      {stacked ? (
        <div className="space-y-2">
          <div className="flex gap-2">
            {countrySelect}
            {codeInput}
          </div>
          <button type="submit" className={`${buttonStyles.primary} w-full`}>
            Find my community
          </button>
        </div>
      ) : (
        <div className={`flex flex-col gap-2 sm:flex-row ${compact ? "" : "rounded-md border-[1.5px] border-ink bg-surface p-2"}`}>
          {countrySelect}
          {codeInput}
          <button type="submit" className={`${buttonStyles.primary} shrink-0 ${compact ? "" : "px-6 text-base"}`}>
            Find my community
          </button>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </form>
  );
}
