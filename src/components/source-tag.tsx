"use client";

import { useEffect } from "react";
import { keepFirst, readTag, SOURCE_COOKIE_DAYS, sourceCookie } from "@/lib/sources";

// Remembers how someone arrived (#67): a link tagged ?src=flyer saves "flyer"
// for this cause (and event) for 30 days, so joining later — even after
// signing up — counts it. The tag is then taken off the address, so a link
// copied from here isn't counted as the flyer again.
export function SourceTag({ ids }: { ids: string[] }) {
  const key = ids.join(",");
  useEffect(() => {
    const url = new URL(window.location.href);
    // A source ("flyer"), or a leader's invite ("invite.k7m2qp", #68).
    const source = readTag(url.searchParams.get("src"));
    if (!url.searchParams.has("src")) return;
    if (source) {
      for (const id of key.split(",")) {
        const name = sourceCookie(id);
        const existing = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))?.[1];
        const keep = keepFirst(existing, source);
        if (keep && keep !== existing) document.cookie = `${name}=${keep}; path=/; max-age=${SOURCE_COOKIE_DAYS * 86400}; samesite=lax`;
      }
    }
    url.searchParams.delete("src");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  }, [key]);
  return null;
}
