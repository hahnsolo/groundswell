import type { NextRequest } from "next/server";
import { rateLimit } from "@/lib/rate-limit";

// Canadian representatives by full postal code, via Open North's Represent API.
// The postal code is passed through and never stored.
export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("postal") ?? "";
  const postal = raw.replace(/\s/g, "").toUpperCase();
  if (!/^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(postal)) {
    return Response.json({ error: "Enter a full 6-character postal code, like M5V 2T6." }, { status: 400 });
  }
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!rateLimit(`reps:${ip}`, 30, 60 * 60 * 1000)) {
    return Response.json({ error: "Too many lookups. Try again later." }, { status: 429 });
  }

  try {
    const res = await fetch(`https://represent.opennorth.ca/postcodes/${postal}/`, {
      signal: AbortSignal.timeout(8000),
      headers: { Accept: "application/json" },
    });
    if (res.status === 404) return Response.json({ representatives: [] });
    if (!res.ok) throw new Error(String(res.status));
    const data = await res.json();
    const all = [...(data.representatives_centroid ?? []), ...(data.representatives_concordance ?? [])];
    const seen = new Set<string>();
    const representatives = all
      .filter((r) => {
        const key = `${r.elected_office}|${r.name}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((r) => ({
        name: r.name,
        elected_office: r.elected_office,
        district_name: r.district_name,
        party_name: r.party_name || undefined,
        email: r.email || undefined,
        url: r.url || undefined,
      }));
    return Response.json({ representatives });
  } catch {
    return Response.json({ error: "The representative lookup service is unavailable right now." }, { status: 502 });
  }
}
