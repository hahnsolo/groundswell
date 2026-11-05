import { NextResponse } from "next/server";
import { findShortCode } from "@/lib/spread";
import { readSource } from "@/lib/sources";

// Short links from flyers and posts (#67): /go/k7m2qp (the flyer's QR code and
// typed link) or /go/k7m2qp/ig (an Instagram post). Sends people to the page,
// tagged with where they came from.
export async function GET(request: Request, { params }: RouteContext<"/go/[code]/[[...src]]">) {
  const { code, src } = await params;
  const target = await findShortCode(code.toLowerCase());
  const base = new URL(request.url);
  if (!target) return NextResponse.redirect(new URL("/", base), 307);
  const source = readSource(src?.[0]) ?? "flyer";
  const path = target.kind === "cause" ? `/causes/${target.id}` : `/events/${target.id}`;
  return NextResponse.redirect(new URL(`${path}?src=${source}`, base), 307);
}
