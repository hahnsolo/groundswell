import type { NextRequest } from "next/server";
import { unsubscribe } from "@/lib/notify";

// One-click unsubscribe (RFC 8058): mail apps POST here from the
// List-Unsubscribe header. Opening the link in a browser goes to the page,
// which asks first.

export async function POST(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const ok = await unsubscribe(q.get("u") ?? "", q.get("k") ?? "", q.get("t") ?? "");
  return new Response(ok ? "Unsubscribed." : "That unsubscribe link isn't valid.", { status: ok ? 200 : 400 });
}

export function GET(request: NextRequest) {
  return Response.redirect(new URL(`/unsubscribe${request.nextUrl.search}`, request.url), 303);
}
