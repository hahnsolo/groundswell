# The Groundswell handbook

Plain-language guides to everything that runs Groundswell: what each piece is, why it was chosen, what it costs, and how to look after it. No secret values appear anywhere in these docs.

| Guide | Read it when… |
|---|---|
| [Walkthrough](walkthrough.md) | You want a picture-by-picture tour of every page and feature, and who can do what. |
| [Accounts and costs](accounts-and-costs.md) | You want to know which services we use, what they do, and what could ever cost money. |
| [Keys and secrets](keys-and-secrets.md) | You're adding, checking or replacing a setting or password-like key. |
| [Day to day](day-to-day.md) | You're running the app on your PC, making a change, checking a deploy, or moderating. |
| [DNS](dns.md) | You're in GoDaddy's DNS page and need to know what's safe to touch. |
| [Security and spam](security-and-spam.md) | You want to know what protects the site and what's still on the to-do list. |
| [Troubleshooting](troubleshooting.md) | Something's broken. Lessons from the first setup night. |

The main [README](../README.md) in the project folder covers the same ground in a more technical way (step-by-step deploy setup, Google/Apple sign-in setup).

---

## What Groundswell is

Groundswell is a website where someone types in their postal code (a Canadian code like `M5V` or a US ZIP like `90210`) and sees the local issues their neighbours care about. They can:

- **raise an issue** (a pothole, a park that needs lights, a dangerous crossing)
- **show support** ("I care") and **discuss** it
- **organize meetups** (in person or online) and RSVP
- **run advocacy campaigns**: a clear ask, a decision-maker, a signature goal, and a letter builder that drafts an email to that person. Canadians can look up their representatives.

It's live at **https://groundswell.hahnsolo.ca**. It also works as an installable app on phones (a "PWA", which is a website that can be added to your home screen and behaves like an app).

For privacy, it only ever stores the coarse area (the first three characters of a Canadian code, or the US ZIP), never a street address.

## How the pieces fit

```
                         ┌──────────────────────────┐
  Someone's browser ───► │  GoDaddy DNS             │  "groundswell.hahnsolo.ca
  or phone               │  (the address book)      │   lives at Vercel"
                         └────────────┬─────────────┘
                                      ▼
                         ┌──────────────────────────┐
                         │  Vercel                  │  runs the website code
                         │  (the web server)        │  (Cleveland data centre)
                         └──┬──────────┬─────────┬──┘
                            │          │         │
              ┌─────────────┘          │         └──────────────┐
              ▼                        ▼                        ▼
   ┌────────────────────┐   ┌────────────────────┐   ┌────────────────────┐
   │ Neon               │   │ Resend             │   │ Cloudflare         │
   │ (the database:     │   │ (sends emails:     │   │ Turnstile          │
   │ users, issues,     │   │ confirm-your-email,│   │ (the "are you      │
   │ comments…)         │   │ password reset)    │   │ human?" check)     │
   └────────────────────┘   └────────────────────┘   └────────────────────┘
        Ohio (us-east-2)                                 not switched on yet

  GitHub holds the code. Every time a change is pushed to GitHub,
  Vercel automatically rebuilds and redeploys the site.
```

In words:

1. **GitHub** stores the code ([github.com/hahnsolo/groundswell](https://github.com/hahnsolo/groundswell)). It's the single source of truth.
2. **Vercel** watches GitHub. When new code lands on the `main` branch, it builds the site, updates the database structure if needed, and puts the new version live. It runs in Cleveland (`cle1`) because that's right next to the database in Ohio, which keeps every page fast.
3. **GoDaddy** is where the `hahnsolo.ca` domain is registered. We added a few records under `groundswell` so the address points at Vercel and so email can be sent from it. Your personal Microsoft 365 email is untouched.
4. **Neon** is the database (Postgres). It has two copies, called branches: `main` for the live site and `dev` for your PC, filled with demo data.
5. **Resend** sends the site's emails from `no-reply@groundswell.hahnsolo.ca`.
6. **Cloudflare Turnstile** is the bot check on sign-up, sign-in and password reset. The code is ready, but it stays off until its keys are added (see [Security and spam](security-and-spam.md)).
7. **Google and Apple sign-in** are built in too, but stay hidden until their keys are added. Both are optional.

## The code at a glance

You don't need to read the code, but this is where things live if you're curious:

```
prisma/schema.prisma      what's stored in the database (users, issues, comments…)
prisma/migrations/        step-by-step history of database changes
prisma/seed.ts            demo data for your PC (never the live site)
src/app/                  the pages: home, area, issue, sign-in, /me, /admin/reports
src/app/actions/          everything that saves something (posting, signing, reporting)
src/lib/better-auth.ts    login settings
src/lib/spam.ts           bot check, posting limits, link rules
src/lib/rate-limit.ts     the "slow down" counter
src/lib/mail.ts           sending email through Resend
.env.example              template for your local settings (no real values)
```

## Why these choices

- **Next.js on Vercel:** Vercel makes Next.js, so the two fit together with almost no setup, and the free plan covers a project this size. Push-to-deploy means there's no server to babysit.
- **Neon for Postgres:** a real, standard database (so we're never locked in) with a generous free tier and "branches", which let your PC use a separate copy so testing can never damage live data.
- **Better Auth for login:** open source and free, stores everything in our own database (no per-user fees like some login services), and supports Google and Apple when we want them.
- **Resend for email:** simple, free for low volumes, and sending from a `groundswell.` subdomain keeps the app's email reputation separate from your personal email.
- **Turnstile for bot checks:** free, privacy-friendly, and usually invisible to real people. It doesn't require moving the domain to Cloudflare.
