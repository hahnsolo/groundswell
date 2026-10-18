# Accounts and costs

Groundswell currently costs **$0 a month**. Everything runs on free plans. This page lists every outside account, what it does for us, where the free plan's limits are, and what would ever make it cost money.

Free-plan limits change from time to time. The numbers below are approximate as of October 2026, so check each service's pricing page before relying on them.

## Summary

| Account | What it does | Plan now | What would cost money |
|---|---|---|---|
| GitHub | Stores the code | Free | Nothing we need |
| Vercel | Runs the website | Hobby (free) | Commercial use, or very heavy traffic |
| Neon | The database | Free | Lots of data, or being busy around the clock |
| Resend | Sends emails | Free | More than ~3,000 emails/month or ~100/day |
| GoDaddy | The `hahnsolo.ca` domain and DNS | Already paid for | The yearly domain renewal (which you already pay) |
| Cloudflare Turnstile *(optional, not set up yet)* | Bot check | Free | Nothing at our scale |
| Google sign-in *(optional, not set up)* | "Sign in with Google" | Free | Nothing |
| Apple sign-in *(optional, not set up)* | "Sign in with Apple" | — | $99 USD/year Apple Developer membership |

---

## GitHub: the code

- **What it does:** holds the code at [github.com/hahnsolo/groundswell](https://github.com/hahnsolo/groundswell) and keeps a full history of every change. Vercel reads it from here.
- **Account:** `hahnsolo`.
- **The repo is public.** Anyone can read the code. That's fine, because no secrets are in it: they live in `.env` (which git ignores) and in Vercel's settings. It does mean you should never paste a key into a code file.
- **Cost:** free. Paid GitHub plans add team features we don't need.

## Vercel: the web server

- **What it does:** builds the site every time code is pushed to `main`, runs it, and gives it HTTPS (the padlock) automatically. Project: `hahnsolo/groundswell`. Server region: Cleveland (`cle1`), next to the database.
- **Plan:** Hobby (free). It includes plenty of bandwidth and server time for a community site.
- **Would cost money:** Vercel's Hobby plan is for **non-commercial use only**. If Groundswell ever takes donations, runs ads or sells anything, you'd need Pro (about $20 USD/month per team member). Very heavy traffic would also push you toward Pro. On Hobby, Vercel pauses the site when you hit a limit; it doesn't send a surprise bill.

## Neon: the database

- **What it does:** stores everything: accounts, issues, comments, meetups, campaigns, reports, and the rate-limit counters.
- **Region:** AWS US East 2 (Ohio).
- **Branches:** `main` is the live site's data. `dev` is a separate copy for your PC, filled with demo data. Changing or wiping `dev` can never affect the live site.
- **Plan:** Free. It includes a small amount of storage per project (about 0.5 GB, which is a lot of text posts) and a monthly allowance of compute time. The database **goes to sleep after a few minutes of no visitors** and wakes on the next visit. That's how it stays free; see [Troubleshooting](troubleshooting.md#the-first-page-load-after-a-quiet-spell-is-slow).
- **Would cost money:** outgrowing the storage, or having steady traffic all day and night so it never sleeps. Neon's Launch plan is usage-based (starting around $5–20 USD/month for a small site). The free plan stops rather than billing you.

## Resend: email

- **What it does:** sends the two kinds of email the site needs: "confirm your email" and "reset your password." They come from `Groundswell <no-reply@groundswell.hahnsolo.ca>`.
- **Plan:** Free, about 3,000 emails per month and 100 per day, for one domain.
- **Would cost money:** going past those limits. The Pro plan is about $20 USD/month for 50,000 emails. Past the free limit, sending simply fails until the next day or month, with no surprise bill. The site's own rate limits (a few emails per person per hour) keep a bot from burning through the allowance.

## GoDaddy: the domain and DNS

- **What it does:** you own `hahnsolo.ca` through GoDaddy, and GoDaddy's DNS is the "address book" that tells the internet where `groundswell.hahnsolo.ca` lives. Your Microsoft 365 email for `hahnsolo.ca` also depends on records there. See [DNS](dns.md) for exactly what was added and what must never be touched.
- **Cost:** only the domain renewal you already pay. Adding DNS records is free. GoDaddy will try to upsell things like "premium DNS" or "website security." We don't need any of them.

## Cloudflare Turnstile: the bot check (optional, recommended)

- **What it does:** an "are you human?" check on sign-up, sign-in and password reset. It's usually invisible; sometimes people see a quick checkbox.
- **Status:** the code is built in but **switched off** until its two keys are added to Vercel. Setting it up is on the to-do list (see [Security and spam](security-and-spam.md)).
- **Needs:** a free Cloudflare account. You do **not** need to move your DNS to Cloudflare.
- **Cost:** free.

## Google sign-in (optional)

- **What it does:** adds a "Sign in with Google" button. Google confirms the person's email, so they can post right away.
- **Status:** not set up. The button stays hidden until the keys are added.
- **Needs:** a free Google Cloud project with an "OAuth client." The steps are in the main [README](../README.md#sign-in-with-google).
- **Cost:** free.

## Apple sign-in (optional)

- **What it does:** adds "Sign in with Apple."
- **Status:** not set up; hidden until configured.
- **Cost:** **$99 USD/year** for an Apple Developer membership. It's the only optional piece that costs money. Worth it mainly if lots of your users are on iPhones and dislike making passwords.

## Free outside services the app uses (no account needed)

- **zippopotam.us** turns a postal code into a place name and map coordinates. Each code is looked up once and then remembered in our database.
- **Represent by Open North** (`represent.opennorth.ca`) looks up Canadian elected representatives by full postal code. The postal code is passed along and never stored.

These are free public services. If one goes down, that one feature shows a friendly error; the rest of the site keeps working.

## Keeping costs at zero: a checklist

- Don't add a credit card anywhere unless you've decided to upgrade. Without one, free plans stop at their limits instead of billing.
- If you do add a card (for example, to Neon), set a **spending limit** or usage alert in that service first.
- Turn on 2-step verification on every account above. A stolen account is the most likely way to get a surprise bill. See [Security and spam](security-and-spam.md#still-to-do).
