import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { leadsCause } from "@/lib/leadership";
import { isoDay, petitionCsv, petitionFileName, petitionRows } from "@/lib/petition";
import { petitionPdf } from "@/lib/petition-pdf";
import { appUrl } from "@/lib/spread";

// Download a campaign's petition with its signatures (#74), as a PDF or a
// spreadsheet. Only for the people leading the cause; everyone else gets "not found".
export async function GET(_request: Request, { params }: RouteContext<"/petition/[campaignId]/[format]">) {
  const { campaignId, format } = await params;
  if (format !== "pdf" && format !== "csv") return new Response("Not found", { status: 404 });
  const user = await getCurrentUser();
  if (!user) return new Response("Not found", { status: 404 });

  const campaign = await db.campaign.findUnique({
    where: { id: campaignId },
    select: {
      ask: true,
      target: true,
      cause: {
        select: {
          id: true,
          title: true,
          placeName: true,
          region: true,
          removedAt: true,
          leaderId: true,
          coLeaders: { select: { userId: true, acceptedAt: true, createdAt: true } },
        },
      },
      signatures: {
        select: { createdAt: true, note: true, user: { select: { name: true, deactivatedAt: true, homeCountry: true, homePostal: true } } },
      },
    },
  });
  if (!campaign || campaign.cause.removedAt || !leadsCause(campaign.cause, user.id)) return new Response("Not found", { status: 404 });

  const rows = petitionRows(campaign.signatures);
  const name = petitionFileName(campaign.ask, format);
  const headers = { "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "private, no-store" };
  if (format === "csv") return new Response(petitionCsv(rows), { headers: { ...headers, "Content-Type": "text/csv; charset=utf-8" } });

  const pdf = await petitionPdf({
    ask: campaign.ask,
    target: campaign.target,
    causeTitle: campaign.cause.title,
    place: `${campaign.cause.placeName}, ${campaign.cause.region}`,
    url: `${appUrl()}/causes/${campaign.cause.id}`,
    generatedOn: isoDay(new Date()),
    rows,
  });
  return new Response(new Uint8Array(pdf), { headers: { ...headers, "Content-Type": "application/pdf" } });
}
