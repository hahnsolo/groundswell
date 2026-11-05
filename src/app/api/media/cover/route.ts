import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canSetCover, setCover, uploadsState } from "@/lib/covers";
import { storageReady } from "@/lib/media-store";
import { ALT_MAX, fileProblem, MAX_UPLOAD_BYTES, UPLOADS_PER_HOUR, uploadProblem } from "@/lib/media-rules";
import { HOUR, rateLimit } from "@/lib/rate-limit";

// Uploading a cover image (#66). A route rather than a server action, so the
// picker can show upload progress. The browser has already resized the image
// to WebP without its hidden details; everything is checked again here.

const fail = (error: string, status = 400) => Response.json({ error }, { status });

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return fail("Sign in to add an image.", 401);
  if (!storageReady()) return fail("Image uploads aren't set up yet.", 503);

  const form = await request.formData().catch(() => null);
  if (!form) return fail("Something went wrong. Please try again.");
  const target = form.get("target");
  const id = String(form.get("id") ?? "");
  const alt = String(form.get("alt") ?? "").trim().slice(0, ALT_MAX);
  const full = form.get("full");
  const thumb = form.get("thumb");
  if ((target !== "cause" && target !== "event") || !id || !(full instanceof File) || !(thumb instanceof File)) return fail("Something went wrong. Please try again.");

  const account = await db.user.findUnique({ where: { id: user.id }, select: { createdAt: true } });
  const problem = account && uploadProblem({ ...account, isAdmin: user.isAdmin, emailVerified: user.emailVerified });
  if (!account || problem) return fail(problem ?? "Sign in to add an image.", 403);
  if (!(await canSetCover(target, id, user))) return fail(target === "cause" ? "Only the people leading this cause can change its image." : "Only the host or the cause's leaders can change this event's image.", 403);
  if ((await uploadsState()) === "full") return fail("Image uploads are paused for now while we make room. Please try again later.", 503);
  if (!(await rateLimit(`upload:${user.id}`, UPLOADS_PER_HOUR, HOUR))) return fail("You've added a lot of images this hour. Try again later.", 429);

  const [fullBytes, thumbBytes] = await Promise.all([full.arrayBuffer(), thumb.arrayBuffer()]).then((b) => b.map((x) => new Uint8Array(x)));
  const bad = fileProblem(fullBytes) ?? fileProblem(thumbBytes, MAX_UPLOAD_BYTES / 4);
  if (bad) return fail(bad);

  const url = await setCover(target, id, user.id, fullBytes, thumbBytes, alt);
  return Response.json({ ok: true, url });
}
