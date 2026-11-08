// Fills the DEV database with a 10,000-person Groundswell for the load test. Run
// `npm run db:seed` first (it clears old data), and never point this anywhere else:
// it has the same guard as the seed script.
import { createHmac, randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

process.loadEnvFile();
if (process.env.ALLOW_DB_SEED !== "yes" || process.env.NODE_ENV === "production" || process.env.VERCEL) {
  console.error('Refusing to run: only for your dev database, with ALLOW_DB_SEED="yes" in your local .env.');
  process.exit(1);
}

const USERS = 10_000;
const CAUSES = 1_000;
const BUSY_AREA_CAUSES = 150; // causes around M5V, the busiest neighbourhood
const BUSY_MEMBERS = 2_000; // people in the busiest cause
const BUSY_MESSAGES = 5_000; // messages in its chat
const SESSIONS = 500; // signed-in people the test can act as
const DAY = 24 * 60 * 60 * 1000;
const CATEGORIES = ["safety", "transit", "housing", "environment", "parks", "schools", "health"];

const db = new PrismaClient();
const now = Date.now();
const longAgo = new Date(now - 60 * DAY);
const pick = (n) => Math.floor(Math.random() * n);
const id = (kind, n) => `cl${kind}${n.toString(36).padStart(21, "0")}`;
const userId = (n) => id("u", n);
const causeId = (n) => id("c", n);

async function inserts(label, model, rows) {
  const start = Date.now();
  for (let i = 0; i < rows.length; i += 5000) await db[model].createMany({ data: rows.slice(i, i + 5000), skipDuplicates: true });
  console.log(`${label}: ${rows.length} (${((Date.now() - start) / 1000).toFixed(1)}s)`);
}

await inserts(
  "people",
  "user",
  Array.from({ length: USERS }, (_, n) => ({
    id: userId(n),
    name: `Neighbour ${n}`,
    email: `n${n}@load.test`,
    emailVerified: true,
    createdAt: longAgo,
    homeCountry: "CA",
    homePostal: "M5V",
    notifyChatDigest: n % 20 === 0, // 5% want the daily chat summary: 500 people
  })),
);

const place = (n) =>
  n < BUSY_AREA_CAUSES
    ? { postalCode: "M5V", placeName: "Downtown Toronto", region: "ON", lat: 43.6525 + (pick(100) - 50) / 2000, lng: -79.3686 + (pick(100) - 50) / 2000 }
    : { postalCode: "K1A", placeName: "Elsewhere", region: "ON", lat: 45 + pick(1000) / 100, lng: -75 - pick(4000) / 100 };

await inserts(
  "causes",
  "cause",
  Array.from({ length: CAUSES }, (_, n) => ({
    id: causeId(n),
    title: `Cause ${n}: fix the crossing on street ${n}`,
    description: "Neighbours want this fixed. ".repeat(8),
    category: CATEGORIES[n % CATEGORIES.length],
    stage: "gathering",
    country: "CA",
    ...place(n),
    authorId: userId(n),
    leaderId: userId(n),
    createdAt: longAgo,
  })),
);

// The busiest cause has 2,000 members; everyone else joins about 3 causes.
const members = new Map();
const join = (cause, user) => members.set(`${cause}:${user}`, { causeId: causeId(cause), userId: userId(user), createdAt: longAgo });
for (let u = 0; u < BUSY_MEMBERS; u++) join(0, u);
for (let u = 0; u < USERS; u++) for (let k = 0; k < 3; k++) join(pick(u % 2 ? BUSY_AREA_CAUSES : CAUSES), u);
await inserts("memberships", "causeMember", [...members.values()]);

const messages = [];
for (let m = 0; m < BUSY_MESSAGES; m++) {
  messages.push({ causeId: causeId(0), authorId: userId(pick(BUSY_MEMBERS)), body: `Message ${m} about the crossing and what we do next.`, createdAt: new Date(now - DAY - (BUSY_MESSAGES - m) * 60000) });
}
for (let c = 1; c < CAUSES; c++) {
  for (let m = 0; m < 20; m++) messages.push({ causeId: causeId(c), authorId: userId(c), body: `Message ${m} on this cause.`, createdAt: new Date(now - (m + 1) * DAY) });
}
await inserts("messages", "comment", messages);

// 200 events coming up, 20 of them tomorrow (the daily job reminds people about those).
const meetups = Array.from({ length: 200 }, (_, n) => {
  const startsAt = new Date(now + (n < 20 ? DAY * 0.8 : DAY * (3 + (n % 30))));
  return { id: id("m", n), causeId: causeId(n), organizerId: userId(n), title: `Meeting ${n}`, description: "Come along.", startsAt, endsAt: new Date(startsAt.getTime() + 2 * 3600000), location: "Library" };
});
await inserts("events", "meetup", meetups);
const rsvps = new Map();
for (let n = 0; n < meetups.length; n++) for (let k = 0; k < 50; k++) { const u = pick(USERS); rsvps.set(`${n}:${u}`, { meetupId: id("m", n), userId: userId(u) }); }
await inserts("RSVPs", "rsvp", [...rsvps.values()]);

await inserts(
  "notifications",
  "notification",
  Array.from({ length: USERS * 10 }, (_, n) => ({ userId: userId(n % USERS), kind: "announcement", title: "News", body: "Something happened.", url: "/me", createdAt: new Date(now - pick(30) * DAY) })),
);

// Sign-in sessions for the first people, who are all in the busiest cause. Better
// Auth's cookie is the token, a dot, and its HMAC signature.
const sessions = Array.from({ length: SESSIONS }, (_, n) => ({
  id: id("s", n),
  token: randomBytes(24).toString("hex"),
  userId: userId(n),
  expiresAt: new Date(now + 7 * DAY),
  updatedAt: new Date(now),
}));
await inserts("sessions", "session", sessions);
const cookie = (token) => `better-auth.session_token=${encodeURIComponent(`${token}.${createHmac("sha256", process.env.BETTER_AUTH_SECRET).update(token).digest("base64")}`)}`;

const out = new URL("./output/", import.meta.url);
mkdirSync(out, { recursive: true });
// Test sign-ins for this database only; the output folder is git-ignored.
writeFileSync(new URL("./sessions.json", out), JSON.stringify({ busyCause: causeId(0), leader: cookie(sessions[0].token), cookies: sessions.map((s) => cookie(s.token)), events: meetups.slice(0, 20).map((m) => m.id) }));
console.log("Ready.");
await db.$disconnect();
