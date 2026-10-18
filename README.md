# Groundswell

Enter a postal code, see the issues your neighbours care about, meet up, and push for change together.

**Live features**

- **Postal code → community.** US ZIP codes and Canadian postal codes resolve to a place and coordinates (via [zippopotam.us](https://zippopotam.us), cached in the DB). Only the coarse area is stored (ZIP / Canadian FSA), never a street address.
- **Local issue feed.** Issues within 2–50 km, filter by category, sort by support or newest.
- **Raise an issue.** Title, category, details, location.
- **Connect.** "I care" support, threaded discussion, community reports (3 reports auto-hide content for review).
- **Meetups.** Create in-person or online meetups with optional capacity; RSVP; times shown in each viewer's own timezone.
- **Advocacy.** Campaigns with a concrete ask, a decision-maker target and a signature goal; a letter builder that drafts an email to that decision-maker; representative lookup (Canada via [Represent](https://represent.opennorth.ca), US links to usa.gov).
- **Accounts.** Email + password (scrypt), DB-backed sessions in httpOnly cookies, rate-limited auth and posting.
- **Email verification.** New accounts get a confirmation link; posting issues, comments, meetups and campaigns requires a confirmed email. (Supporting, RSVPing and signing don't.)
- **Password reset.** Single-use, 1-hour emailed links; resetting signs out every other device.
- **Moderation queue.** Admins review reported content at `/admin/reports` and keep or remove it; every decision is recorded on the report (who, when, what). Non-admins get a 404.

## Stack

Next.js 16 (App Router, Cache Components, Server Actions) · React 19 · TypeScript · Tailwind CSS 4 · Prisma 6 · SQLite locally (Postgres in production) · Zod.

## Run it locally

```bash
npm install
cp .env.example .env
npm run db:migrate
npm run db:seed
npm run dev
```

Open http://localhost:3000 and try ZIP `90210` or postal code `M5V`. Demo accounts are listed at the top of `prisma/seed.ts` (the first one is an admin).

In development, verification and reset emails aren't sent — they're printed in the terminal running `npm run dev`, so you can click the link.

To make someone an admin: `npm run db:studio`, open the `User` table, and tick `isAdmin`.

Useful scripts: `npm run typecheck`, `npm run lint`, `npm run db:studio` (browse the database).

## Project layout

```
prisma/schema.prisma        data model
prisma/seed.ts              demo data
src/lib/countries.ts        per-country postal rules (add a country here)
src/lib/places.ts           postal code → place lookup + cache
src/lib/auth.ts             sessions, current user
src/lib/queries.ts          read queries (nearby issues, issue detail)
src/app/actions/            all writes (Server Actions), validated with Zod
src/app/area/[country]/[postal]   the community page
src/app/issues/[id]         issue page: discussion, meetups, advocacy
src/app/api/representatives Canadian representative lookup
```

## Adding a country

Add an entry to `COUNTRIES` in `src/lib/countries.ts` (code, label, regex, normalizer). zippopotam.us already covers ~60 countries. If the country has a representatives API, add a branch in `RepLookup` and the `/api/representatives` route.

## Going to production

1. **Database:** create a Postgres database (Neon, Supabase, RDS…). In `prisma/schema.prisma` set `provider = "postgresql"`, delete `prisma/migrations`, and run `npx prisma migrate dev --name init` against it. Set `DATABASE_URL`.
2. **Env:** set `APP_URL` to the public URL (used in share links, letters and emailed links). Create a [Resend](https://resend.com) account, verify your sending domain, and set `RESEND_API_KEY` and `MAIL_FROM`. The app refuses to send email in production without them.
3. **Deploy:** Vercel works out of the box; any Node host works with `npm run build && npm start`.
4. **Before opening to the public:**
   - Swap the in-memory rate limiter (`src/lib/rate-limit.ts`) for Redis/Upstash when running more than one instance.
   - Add terms of use / privacy policy and a code of conduct.
   - For global scale, move nearby-issue search to PostGIS (`ST_DWithin`); the current bounding-box query is fine for thousands of issues per area.
