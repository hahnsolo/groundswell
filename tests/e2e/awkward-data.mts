// Dev-only: adds deliberately awkward content (very long titles, names and links,
// a busy neighbourhood) for the visual sweep. Run after `npm run db:seed`.
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
process.loadEnvFile();
if (process.env.ALLOW_DB_SEED !== "yes" || process.env.VERCEL) throw new Error("dev database only");
const db = new PrismaClient();
const DAY = 864e5;
const ago = (d: number) => new Date(Date.now() - d * DAY);
const M5V = { country: "CA", postalCode: "M5V", placeName: "Downtown Toronto", region: "ON", lat: 43.6525, lng: -79.3686 };

const alex = await db.user.findUniqueOrThrow({ where: { email: "alex@demo.test" } });
const longName = "Bartholomew-Alexandria Featherstonehaugh-Worthington";
const people = await Promise.all(
  [longName, ...Array.from({ length: 16 }, (_, i) => `Neighbour ${i + 1}`)].map((name, i) =>
    db.user.create({ data: { id: randomUUID(), name, email: `sweep${i}@demo.test`, emailVerified: true, createdAt: ago(60) } }),
  ),
);
const longWord = "Supercalifragilisticexpialidociousneighbourhoodassociationcommittee";
const longUrl = "https://www.toronto.ca/services-payments/streets-parking-transportation/road-maintenance/bridges-and-expressways/a-very-long-path-segment-that-never-breaks";
const awkward = await db.issue.create({
  data: {
    ...M5V,
    title: `The ${longWord} wants the whole length of King St West repaved before winter, safely and accessibly`,
    description: `First paragraph about the road, which has been crumbling for years and keeps getting patched badly.\n\nSecond paragraph with an unbroken link: ${longUrl}\n\nThird paragraph: ${"Very long sentence that goes on and on without stopping. ".repeat(12)}`,
    category: "transit",
    authorId: people[0].id,
    createdAt: ago(20),
    supports: { create: [people[0], ...people.slice(1), alex].map((p, i) => ({ userId: p.id, createdAt: ago(10 - (i % 9)) })) },
    comments: {
      create: Array.from({ length: 30 }, (_, i) => ({
        authorId: people[i % people.length].id,
        body: i === 3 ? `Look at ${longUrl}` : i === 7 ? longWord.repeat(3) : i % 5 === 0 ? "ok" : `Message ${i + 1}: ${"we should all come to the meeting and bring our neighbours. ".repeat((i % 4) + 1)}`,
        createdAt: new Date(Date.now() - (30 - i) * 3600e3),
      })),
    },
    meetups: {
      create: [
        {
          organizerId: people[0].id,
          title: `Walk the whole of King Street West with the ${longWord} and the city's road inspectors`,
          description: "Bring water. ".repeat(40),
          startsAt: new Date(Date.now() + 2 * DAY),
          location: `Meet at the north-east corner of King Street West and Spadina Avenue, outside the coffee shop with the green awning, next to the bike racks — ${"look for the orange flag. ".repeat(4)}`,
          capacity: 40,
          rsvps: { create: people.slice(0, 12).map((p) => ({ userId: p.id })) },
        },
        {
          organizerId: alex.id,
          title: "Online planning call",
          description: "",
          startsAt: new Date(Date.now() + 9 * DAY),
          location: longUrl,
          isOnline: true,
          rsvps: { create: [{ userId: alex.id }] },
        },
      ],
    },
    campaigns: {
      create: {
        creatorId: people[0].id,
        target: `City of Toronto Transportation Services, Infrastructure and Environment Committee, and ${longWord}`,
        ask: "Repave King Street West from Bathurst to Spadina before the first snowfall. ".repeat(6),
        goal: 500,
        signatures: { create: people.slice(0, 15).map((p, i) => ({ userId: p.id, note: i % 4 === 0 ? `${longWord} ${"because it matters. ".repeat(6)}` : null })) },
      },
    },
  },
});

// A busy neighbourhood: a dozen more causes.
for (let i = 0; i < 12; i++) {
  await db.issue.create({
    data: {
      ...M5V,
      lat: M5V.lat + (i - 6) * 0.004,
      title: i % 3 === 0 ? `Short one ${i}` : `Cause number ${i + 1} about something on a street nearby that people care about a great deal`,
      description: "Details. ".repeat(30),
      category: ["safety", "housing", "parks", "environment", "health"][i % 5],
      status: i === 4 ? "in_progress" : "open",
      authorId: people[(i + 1) % people.length].id,
      createdAt: ago(i),
      supports: { create: people.slice(0, (i % 6) + 1).map((p) => ({ userId: p.id, createdAt: ago(i % 9) })) },
    },
  });
}
console.log(`Added awkward content (cause ${awkward.id}).`);
await db.$disconnect();
