import { NextResponse } from "next/server";
import { findInviteCode } from "@/lib/spread";

// A leader's personal invite link (#68): /i/k7m2qp opens the cause, tagged with
// whose invite it was, so joining counts toward "joined from your invite".
export async function GET(request: Request, { params }: RouteContext<"/i/[code]">) {
  const { code } = await params;
  const lower = code.toLowerCase();
  const invite = await findInviteCode(lower);
  const base = new URL(request.url);
  if (!invite) return NextResponse.redirect(new URL("/", base), 307);
  return NextResponse.redirect(new URL(`/causes/${invite.causeId}?src=invite.${lower}`, base), 307);
}
