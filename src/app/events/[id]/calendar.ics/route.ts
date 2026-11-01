import { getCurrentUser } from "@/lib/auth";
import { getEventDetail } from "@/lib/event-queries";
import { buildIcs } from "@/lib/ics";

// "Add to calendar": downloads the event as an .ics file.
export async function GET(_req: Request, ctx: RouteContext<"/events/[id]/calendar.ics">) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  const e = await getEventDetail(id, user?.id ?? null);
  if (!e || e.cause.removedAt || (e.cause.hidden && e.cause.authorId !== user?.id)) {
    return new Response("Not found", { status: 404 });
  }
  const url = `${process.env.APP_URL ?? "http://localhost:3000"}/events/${e.id}`;
  const ics = buildIcs({
    id: e.id,
    title: e.title,
    startsAt: e.startsAt,
    // Online links are only for people going, so the file just says "Online" and points back here.
    location: e.isOnline ? "Online (link on the event page)" : e.location,
    description: e.description,
    url,
  });
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="groundswell-event.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}
