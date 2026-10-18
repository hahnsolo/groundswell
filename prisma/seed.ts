// Demo data for local development: `npm run db:seed`.
// Demo accounts (local only): alex@demo.test (admin), sam@demo.test, priya@demo.test
// Password for all of them: groundswell-demo
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
// Better Auth's own hasher, so seeded passwords work with its sign-in.
import { hashPassword } from "better-auth/crypto";

// This script DELETES all data and creates an admin with a public password,
// so it only ever runs against a local SQLite file, never a real database.
try {
  process.loadEnvFile(); // .env, like Prisma and Next.js read it
} catch {
  // No .env file — rely on the real environment.
}
if (process.env.NODE_ENV === "production" || !process.env.DATABASE_URL?.startsWith("file:")) {
  console.error("Refusing to seed: this only runs against a local SQLite database (DATABASE_URL=\"file:...\").");
  process.exit(1);
}

const db = new PrismaClient();
const DEMO_PASSWORD = "groundswell-demo";

const PLACES = [
  { id: "US-90210", country: "US", postalCode: "90210", placeName: "Beverly Hills", region: "California", regionCode: "CA", lat: 34.0901, lng: -118.4065 },
  { id: "US-90046", country: "US", postalCode: "90046", placeName: "Los Angeles", region: "California", regionCode: "CA", lat: 34.1078, lng: -118.3652 },
  { id: "CA-M5V", country: "CA", postalCode: "M5V", placeName: "Downtown Toronto", region: "Ontario", regionCode: "ON", lat: 43.6525, lng: -79.3686 },
  { id: "CA-M6J", country: "CA", postalCode: "M6J", placeName: "West Toronto", region: "Ontario", regionCode: "ON", lat: 43.6479, lng: -79.4197 },
];

const day = 24 * 60 * 60 * 1000;

async function main() {
  await db.$transaction([
    db.report.deleteMany(),
    db.signature.deleteMany(),
    db.campaign.deleteMany(),
    db.rsvp.deleteMany(),
    db.meetup.deleteMany(),
    db.comment.deleteMany(),
    db.issueSupport.deleteMany(),
    db.issue.deleteMany(),
    db.session.deleteMany(),
    db.account.deleteMany(),
    db.verification.deleteMany(),
    db.user.deleteMany(),
  ]);
  for (const p of PLACES) await db.place.upsert({ where: { id: p.id }, create: p, update: p });

  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const [alex, sam, priya] = await Promise.all(
    [
      { name: "Alex", email: "alex@demo.test", homeCountry: "US", homePostal: "90210" },
      { name: "Sam", email: "sam@demo.test", homeCountry: "US", homePostal: "90046" },
      { name: "Priya", email: "priya@demo.test", homeCountry: "CA", homePostal: "M5V" },
    ].map((u) => {
      const id = randomUUID();
      return db.user.create({
        data: {
          ...u,
          id,
          emailVerified: true,
          isAdmin: u.email === "alex@demo.test",
          // Better Auth keeps email/password logins as a "credential" account keyed by user id.
          accounts: { create: { id: randomUUID(), accountId: id, providerId: "credential", password: passwordHash } },
        },
      });
    }),
  );

  const at = (placeId: string) => {
    const p = PLACES.find((x) => x.id === placeId)!;
    return { country: p.country, postalCode: p.postalCode, placeName: p.placeName, region: p.regionCode, lat: p.lat, lng: p.lng };
  };

  const crosswalk = await db.issue.create({
    data: {
      ...at("US-90210"),
      title: "No safe crossing on Santa Monica Blvd near the elementary school",
      description:
        "Kids heading to school have to cross four lanes with no signal between Wilshire and Rexford. Drivers rarely stop at the painted crosswalk.\n\nA signalized crossing or at least a crossing guard during drop-off would make a huge difference.",
      category: "safety",
      authorId: alex.id,
      createdAt: new Date(Date.now() - 9 * day),
      supports: { create: [{ userId: alex.id }, { userId: sam.id }] },
      comments: {
        create: [
          { authorId: sam.id, body: "My daughter crosses here every morning. I counted 3 near-misses last week alone." },
          { authorId: alex.id, body: "I emailed the city's traffic department — they said a petition with signatures helps get it on the agenda." },
        ],
      },
      meetups: {
        create: {
          organizerId: alex.id,
          title: "Morning crossing count",
          description: "Let's meet at the corner and record how many cars stop for pedestrians during drop-off. Bring a phone for photos.",
          startsAt: new Date(Date.now() + 5 * day),
          location: "Corner of Santa Monica Blvd & Rexford Dr",
          rsvps: { create: [{ userId: alex.id }, { userId: sam.id }] },
        },
      },
      campaigns: {
        create: {
          creatorId: alex.id,
          target: "Beverly Hills City Council",
          ask: "Install a signalized pedestrian crossing at Santa Monica Blvd & Rexford Dr before the next school year, and fund a crossing guard in the meantime.",
          goal: 150,
          signatures: {
            create: [
              { userId: alex.id },
              { userId: sam.id, note: "I walk my kids across here every day. Please act before someone is hurt." },
            ],
          },
        },
      },
    },
  });

  await db.issue.create({
    data: {
      ...at("US-90046"),
      title: "Runyon Canyon trailhead overflowing with trash on weekends",
      description: "Bins at the Fuller Ave entrance overflow by Saturday noon. Wind blows it into the canyon. We need more bins or more frequent pickups on weekends.",
      category: "environment",
      authorId: sam.id,
      createdAt: new Date(Date.now() - 3 * day),
      supports: { create: [{ userId: sam.id }] },
    },
  });

  await db.issue.create({
    data: {
      ...at("CA-M5V"),
      title: "Rent increases above guideline at 3 buildings on Spadina",
      description:
        "Several tenants in buildings near Spadina & King received above-guideline increase notices. Many of us don't know our rights or whether the landlord's application is valid.\n\nLooking to organize a tenants' meeting and connect with a legal clinic.",
      category: "housing",
      authorId: priya.id,
      createdAt: new Date(Date.now() - 2 * day),
      supports: { create: [{ userId: priya.id }] },
      meetups: {
        create: {
          organizerId: priya.id,
          title: "Tenants' rights info night",
          description: "A volunteer from a local legal clinic will explain the AGI process and how to respond.",
          startsAt: new Date(Date.now() + 8 * day),
          location: "Toronto Public Library — Fort York branch, meeting room",
          capacity: 40,
          rsvps: { create: [{ userId: priya.id }] },
        },
      },
    },
  });

  await db.issue.create({
    data: {
      ...at("CA-M6J"),
      title: "Trinity Bellwoods washrooms closed again",
      description: "The park washrooms have been locked for three weeks. Families and seniors are going without. Any update from Parks?",
      category: "parks",
      status: "in_progress",
      authorId: priya.id,
      createdAt: new Date(Date.now() - 12 * day),
      supports: { create: [{ userId: priya.id }] },
    },
  });

  // A reported comment, so the moderation queue has something in it.
  const spam = await db.comment.create({
    data: { issueId: crosswalk.id, authorId: sam.id, body: "BUY CHEAP SUNGLASSES >>> totally-legit-shades.example" },
  });
  await db.report.create({
    data: { targetType: "comment", targetId: spam.id, reporterId: priya.id, reason: "Spam / advertising" },
  });

  console.log(`Seeded demo data. Example issue: /issues/${crosswalk.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
