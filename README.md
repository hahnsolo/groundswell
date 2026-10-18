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

Next.js 16 (App Router, Cache Components, Server Actions) · React 19 · TypeScript · Tailwind CSS 4 · Prisma 6 · Postgres (Neon) · Better Auth · Zod. Installable as a PWA. Deployed on Vercel.

## Run it locally

You need a Postgres database — the free Neon **dev** branch from the deploy steps below works well.

```bash
npm install
cp .env.example .env      # then fill in DATABASE_URL / DIRECT_URL (dev branch) and BETTER_AUTH_SECRET
npm run db:deploy         # create the tables
npm run db:seed           # demo data (wipes the dev database)
npm run dev
```

Open http://localhost:3000 and try ZIP `90210` or postal code `M5V`. Demo accounts are listed at the top of `prisma/seed.ts` (the first one is an admin). `npm run dev` only listens on this computer; `npm run dev:lan` lets other devices on your network (e.g. your phone) connect.

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
| `DATABASE_URL`, `DIRECT_URL` | Always | Neon → Connect (pooled + direct strings) | Free tier |
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

## Deploy (Vercel + Neon + Resend, at groundswell.hahnsolo.ca)

Every push to `main` on GitHub redeploys automatically; the build runs `prisma migrate deploy` first, so the live database stays in step with the code.

**1. Database — [Neon](https://neon.tech)** (free)
- Create a project (region near your users, e.g. AWS US East / Canada).
- **Branches → Create branch** named `dev` — that's for your PC; `main` is for the live site.
- For each branch, **Connect** shows two strings. The **pooled** one (host contains `-pooler`) is `DATABASE_URL` — add `&pgbouncer=true` to the end. The **direct** one is `DIRECT_URL`.
- Put the `dev` branch strings in your local `.env`.

**2. Hosting — [Vercel](https://vercel.com)** (free Hobby plan)
- **Add New → Project → Import** `hahnsolo/groundswell` from GitHub.
- Under **Environment Variables** add: `DATABASE_URL` + `DIRECT_URL` (Neon **main** branch), `APP_URL` = `https://groundswell.hahnsolo.ca`, a **new** `BETTER_AUTH_SECRET`, and the email/Turnstile keys below. Do **not** add `ALLOW_DB_SEED`.
- **Deploy.** It's live at `groundswell-….vercel.app` in a couple of minutes.

**3. Your domain — GoDaddy DNS** (doesn't touch hahnsolo.ca or your Outlook email)
- Vercel → Project → **Settings → Domains → Add** `groundswell.hahnsolo.ca`. It shows the record to create.
- GoDaddy → **My Products → hahnsolo.ca → DNS → Add New Record:** Type `CNAME`, Name `groundswell`, Value = what Vercel shows (usually `cname.vercel-dns.com`), TTL default.
- Vercel issues the HTTPS certificate automatically once DNS updates (minutes to an hour).

**4. Email — [Resend](https://resend.com)** (free tier)
- **Domains → Add Domain** `groundswell.hahnsolo.ca` (a subdomain keeps app mail separate from your personal email's reputation).
- Resend lists about 3 records (an `MX` and a `TXT` on `send.groundswell`, a DKIM `TXT` on `resend._domainkey.groundswell`). Add each in GoDaddy exactly as shown — in GoDaddy's **Name** field, enter only the part before `.hahnsolo.ca`.
- **Leave the existing `@` MX and TXT records alone** — they run your Microsoft 365 email.
- Click **Verify** in Resend, then **API Keys → Create** and set `RESEND_API_KEY` and `MAIL_FROM` = `Groundswell <no-reply@groundswell.hahnsolo.ca>` in Vercel. Redeploy.

**5. Bot protection — [Cloudflare Turnstile](https://dash.cloudflare.com/?to=/:account/turnstile)** (free; no need to move DNS to Cloudflare)
- **Add widget**, hostname `groundswell.hahnsolo.ca`, mode *Managed*. Set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` in Vercel. Redeploy.

**6. Make yourself admin**
- Sign up on the live site and confirm your email. Then in Neon → **SQL Editor** (main branch):
  `UPDATE "User" SET "isAdmin" = true WHERE email = 'you@example.com';`

**Optional:** add `https://groundswell.hahnsolo.ca` (and `/api/auth/callback/google`) to your Google OAuth client to enable Google sign-in.

### Before opening to the public
- Add terms of use / privacy policy and a code of conduct.
- Vercel's free Hobby plan is for non-commercial use; move to Pro if Groundswell takes donations or runs ads.
- For global scale, move nearby-issue search to PostGIS (`ST_DWithin`); the current bounding-box query is fine for thousands of issues per area.
