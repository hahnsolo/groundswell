# Security and spam

Any public site that lets people post gets found by spammers and bots, usually within days. This page explains each layer of protection in Groundswell, why it's there, and what's still left to do before a public launch.

The main code is in `src/lib/spam.ts`, `src/lib/rate-limit.ts`, `src/lib/better-auth.ts` and `src/app/actions/`.

## What protects the site today

### Accounts and login
- **Login is handled by Better Auth**, a well-tested open-source library, rather than home-made code. Passwords are stored as one-way hashes (scrambled so even we can't read them).
- **Passwords must be at least 10 characters.**
- **Sessions last 30 days** and are stored in the database, so they can be cancelled. Resetting your password **signs you out everywhere**.
- **Email confirmation:** new accounts get a confirm link (valid 48 hours). Posting issues, comments, meetups and campaigns, signing campaigns, and reporting all need a confirmed email. Supporting an issue and RSVPing don't. Google and Apple accounts count as confirmed.
- **Password reset links** expire after 1 hour. The reset page gives the same answer whether or not an email has an account, so nobody can use it to find out who's a member.
- **Admin pages are invisible:** anyone who isn't an admin gets "page not found" at `/admin/reports`, not "access denied," so the page's existence isn't revealed. Admin can only be granted directly in the database (see [Day to day](day-to-day.md#making-someone-an-admin)), and the sign-up form can't set it.
- **The live site won't start without a strong `BETTER_AUTH_SECRET`**, so it can never run with a forgeable default.

### Bot check (Cloudflare Turnstile): built, **not switched on yet**
- Covers sign-up, sign-in, password reset and resending the confirmation email, in both our forms *and* the login system's public web addresses (so bots can't skip the form and call those directly).
- If Cloudflare can't be reached, the check **fails closed**: the attempt is refused rather than waved through.
- Until the keys are added, the live site logs a warning: "TURNSTILE_SECRET_KEY is not set."

### Rate limits ("slow down" counters)
The counters are stored in the database, not in server memory. Vercel runs many short-lived copies of the app, and in-memory counters would reset constantly. Database counters are shared and survive restarts.

| Action | Limit |
|---|---|
| Sign in | 20 per 15 min per network address, **and** 10 per 15 min per account (stops password guessing spread across many addresses) |
| Sign up | 10 per hour per network address |
| Password reset | 5 per hour per network address, 3 per hour per email |
| Resend confirmation email | 3 per hour per account |
| Report content | 20 per hour per account |
| Representative lookup | 30 per hour per network address |
| Everything else in the login system | 100 per minute |

### Posting rules
| | Established accounts | New accounts (first 24 hours) |
|---|---|---|
| Issues | 10/hour | 2/hour |
| Comments | 60/hour | 10/hour |
| Meetups | 10/hour | 2/hour |
| Campaigns | 5/hour | 1/hour |
| Links in a post | up to 3 | **none** |

Almost all spam comes from brand-new accounts posting links, so new accounts are held back for their first day. Real neighbours rarely notice. Also:

- **Honeypot:** every form has a hidden "website" field that people never see. Simple bots fill in every field, so if it's filled in, the post is quietly refused.
- **Duplicate comments** (same text from the same person within 10 minutes) are refused. That catches double-clicks and copy-paste bots.
- **Everything posted is checked** for sensible lengths and formats before it's saved. For example, an issue title is 8–120 characters and descriptions are capped at 5,000.

### Community moderation
- Members with a confirmed email can report issues and comments.
- **3 reports** from accounts **older than a day** hide the content automatically until an admin decides. Only older accounts count, so someone can't make three throwaway accounts to silence a person they disagree with.
- Admins review everything at `/admin/reports` (see [Day to day](day-to-day.md#using-the-moderation-queue)). Each decision is recorded.
- **Removing is undoable for a week.** Removed content is hidden from everyone but its author, who sees a notice with the moderator's reason. After 7 days a daily job deletes it for good, so people's words aren't kept longer than needed.
- Removed content can't be reported again, and nothing new (comments, meetups, campaigns) can be added to a removed issue.

### Privacy
- Only the coarse area is stored (Canadian FSA like `M5V`, or a US ZIP), never a street address.
- The full postal code used for the representative lookup is passed to Open North and **not stored**.
- The search-engine tag on the admin page says "don't index."

### Browser-level protections
Every page is sent with standard security headers that stop other sites from embedding Groundswell in a hidden frame (a "clickjacking" trick), stop browsers from guessing file types, and turn off camera, microphone and location access. HTTPS is automatic through Vercel.

### Secrets
No secret is in the code or on GitHub. They're in `.env` (ignored by git) and Vercel's encrypted settings. See [Keys and secrets](keys-and-secrets.md).

## Still to do

In rough order of importance:

1. **Turn on 2-step verification (2FA) on every account:** GitHub, Vercel, Neon, Resend, GoDaddy, Cloudflare, and Google/Apple if used. Whoever gets into GitHub or Vercel controls the site; GoDaddy controls your domain *and* your email. Use an authenticator app rather than text messages where offered, and save the backup codes somewhere safe.
2. **Add the Turnstile keys:** Cloudflare → Turnstile → **Add widget**, hostname `groundswell.hahnsolo.ca`, mode *Managed*. Put `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` in Vercel, then redeploy. Afterwards, sign up with a test account to check that the widget appears.
3. **Add `CRON_SECRET` in Vercel** (before or with the next deploy), so the daily job that deletes removed content can run. See [Keys and secrets](keys-and-secrets.md).
4. **Make your own account an admin** on the live site (see [Day to day](day-to-day.md#making-someone-an-admin)), so someone is watching the moderation queue.
5. **Legal pages:** terms of use, a privacy policy (what's stored, why, and how to get it deleted; Canada's PIPEDA applies), and a code of conduct that says what gets removed. Link them from the sign-up page and footer.
6. **A way to delete your account.** There's no self-service button yet. Until there is, deletion requests are handled by hand in the database.
7. **Later, if spam gets through anyway:** a "report user" feature, admin tools to suspend an account, and tightening DMARC from `p=none` to `p=quarantine` once you've seen that all legitimate email passes.
