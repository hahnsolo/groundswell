# Groundswell

Enter a postal code, see the issues your neighbours care about, meet up, and push for change together.

**Live features**

- **Postal code → community.** US ZIP codes and Canadian postal codes resolve to a place and coordinates (via [zippopotam.us](https://zippopotam.us), cached in the DB). Only the coarse area is stored (ZIP / Canadian FSA), never a street address.
- **Local issue feed.** Issues within 2–50 km, filter by category, sort by support or newest.
- **Raise an issue.** Title, category, details, location.
- **Connect.** "I care" support, threaded discussion, community reports (3 reports from established accounts auto-hide content for review).
- **Meetups.** Create in-person or online meetups with optional capacity; RSVP; times shown in each viewer's own timezone.
- **Advocacy.** Campaigns with a concrete ask, a decision-maker target and a signature goal; a letter builder that drafts an email to that decision-maker; representative lookup (Canada via [Represent](https://represent.opennorth.ca), US links to usa.gov).
- **Accounts** via [Better Auth](https://better-auth.com): email + password, **Sign in with Google**, **Sign in with Apple** (each button appears once its credentials are set). Signing in with Google/Apple links to an existing account with the same email. Sessions are DB-backed; auth endpoints are rate-limited in the database so limits hold across serverless instances.
- **Email verification.** New accounts get a confirmation link; posting, signing campaigns and reporting require a confirmed email. (Supporting and RSVPing don't.) Google/Apple emails count as confirmed.
- **Spam & abuse protection** (`src/lib/spam.ts`, `src/lib/rate-limit.ts`):
  - Cloudflare Turnstile bot check on sign-up, sign-in and password reset — in our forms *and* on Better Auth's public endpoints.
  - Database-backed rate limits (survive restarts, shared across servers): per IP and per account for sign-in/sign-up/reset; per user for every kind of post, report and lookup.
  - New accounts (first 24h): much lower posting limits and no links. Everyone: at most 3 links per post.
  - Hidden honeypot field on every form; duplicate comments within 10 minutes are refused.
  - Only reports from accounts older than a day count toward auto-hiding, so throwaway accounts can't silence people.
- **Password reset.** 1-hour emailed links; resetting signs out every device.
- **Moderation queue.** Admins review reported content at `/admin/reports` and keep or remove it; every decision is recorded on the report (who, when, what). Non-admins get a 404.

## Stack

Next.js 16 (App Router, Cache Components, Server Actions) · React 19 · TypeScript · Tailwind CSS 4 · Prisma 6 · SQLite locally (Postgres in production) · Better Auth · Zod. Installable as a PWA.

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
src/lib/better-auth.ts      Better Auth config (providers, emails, rate limits)
src/lib/auth.ts             current user / requireUser / requireAdmin helpers
src/app/api/auth/[...all]   Better Auth's endpoints (OAuth callbacks, email links)
src/lib/queries.ts          read queries (nearby issues, issue detail)
src/app/actions/            all writes (Server Actions), validated with Zod
src/app/area/[country]/[postal]   the community page
src/app/issues/[id]         issue page: discussion, meetups, advocacy
src/app/api/representatives Canadian representative lookup
```

## Keys and settings

| Variable | Needed for | Where it comes from | Cost |
|---|---|---|---|
| `DATABASE_URL` | Always | Your Postgres host (Neon, Supabase, Railway…) | Free tier available |
| `APP_URL` | Always | Your site's public address | — |
| `BETTER_AUTH_SECRET` | Always | Generate it yourself (command in `.env.example`) | Free |
| `RESEND_API_KEY`, `MAIL_FROM` | Production (emails) | [resend.com](https://resend.com) → API Keys; verify your domain | Free tier |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Production (bot protection) | Cloudflare dashboard → Turnstile → Add widget | Free |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Optional | Google Cloud Console (below) | Free |
| `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` | Optional | Apple Developer portal (below) | $99/year |

Only `NEXT_PUBLIC_…` values are visible to browsers; everything else must stay secret — put it in `.env` locally and in your host's environment settings in production, never in code.

## Sign in with Google

1. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials), create a project, then **Configure consent screen** (External; app name, support email, logo).
2. **Create credentials → OAuth client ID → Web application.**
   - Authorized JavaScript origins: your `APP_URL` (and `http://localhost:3000` for dev).
   - Authorized redirect URIs: `<APP_URL>/api/auth/callback/google` (and `http://localhost:3000/api/auth/callback/google`).
3. Put the client ID and secret in `.env` as `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` and restart. The button appears.

Free. Works on localhost.

## Sign in with Apple

Needs an [Apple Developer](https://developer.apple.com/programs/) membership ($99/year) and an **HTTPS domain** — Apple won't redirect to localhost. (For local testing, use a tunnel such as `cloudflared tunnel --url http://localhost:3000` and set `APP_URL` to the tunnel URL.)

1. **Certificates, IDs & Profiles → Identifiers → App IDs:** create one (e.g. `org.groundswell.app`) with *Sign in with Apple* enabled.
2. **Identifiers → Services IDs:** create one (e.g. `org.groundswell.web`) — this is `APPLE_CLIENT_ID`. Enable *Sign in with Apple*, configure it with your domain and return URL `<APP_URL>/api/auth/callback/apple`.
3. **Keys:** create a key with *Sign in with Apple*, download the `.p8` file (once only). Note its **Key ID**.
4. Set `APPLE_CLIENT_ID`, `APPLE_TEAM_ID` (top right of the developer portal), `APPLE_KEY_ID`, and `APPLE_PRIVATE_KEY` (the `.p8` contents, with newlines written as `\n`).

Apple's "client secret" is a signed token that expires after 6 months; the app signs a fresh one from your key at startup, so there's nothing to renew by hand. Apple only shares a person's name the first time they sign in, and may give a private relay email (`…@privaterelay.appleid.com`) — both are handled.

## Adding a country

Add an entry to `COUNTRIES` in `src/lib/countries.ts` (code, label, regex, normalizer). zippopotam.us already covers ~60 countries. If the country has a representatives API, add a branch in `RepLookup` and the `/api/representatives` route.

## Going to production

1. **Database:** create a Postgres database (Neon, Supabase, RDS…). In `prisma/schema.prisma` set `provider = "postgresql"`, delete `prisma/migrations`, and run `npx prisma migrate dev --name init` against it. Set `DATABASE_URL`.
2. **Env:** set `APP_URL` to the public URL (used in share links, letters, emailed links and OAuth callbacks) and a fresh `BETTER_AUTH_SECRET` (see `.env.example`). Create a [Resend](https://resend.com) account, verify your sending domain, and set `RESEND_API_KEY` and `MAIL_FROM`. The app refuses to send email in production without them. Add your production URL to the Google and Apple consoles.
3. **Deploy:** Vercel works out of the box; any Node host works with `npm run build && npm start`.
4. **Before opening to the public:**
   - Set the Turnstile keys — without them the server logs a warning and sign-up has no bot check.
   - In `src/lib/better-auth.ts`, change the adapter's `provider: "sqlite"` to `"postgresql"` along with the schema.
   - Add terms of use / privacy policy and a code of conduct.
   - For global scale, move nearby-issue search to PostGIS (`ST_DWithin`); the current bounding-box query is fine for thousands of issues per area.
