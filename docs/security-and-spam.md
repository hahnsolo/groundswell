# Security and spam

Any public site that lets people post gets found by spammers and bots, usually within days. This page explains each layer of protection in Groundswell, why it's there, and what's still left to do before a public launch.

The main code is in `src/lib/spam.ts`, `src/lib/rate-limit.ts`, `src/lib/better-auth.ts` and `src/app/actions/`.

## What protects the site today

### Accounts and login
- **Login is handled by Better Auth**, a well-tested open-source library, rather than home-made code. Passwords are stored as one-way hashes (scrambled so even we can't read them).
- **Passwords must be at least 10 characters.**
- **Sessions last 30 days** and are stored in the database, so they can be cancelled. Resetting your password **signs you out everywhere**.
- **Email confirmation:** new accounts get a confirm link (valid 48 hours). Raising causes, posting in a chat, organizing events, starting and signing campaigns, and reporting all need a confirmed email. Joining a cause and RSVPing don't. Google and Apple accounts count as confirmed.
- **Password reset links** expire after 1 hour. The reset page gives the same answer whether or not an email has an account, so nobody can use it to find out who's a member.
- **Admin pages are invisible:** anyone who isn't an admin gets "page not found" at `/admin/reports`, not "access denied," so the page's existence isn't revealed. Admin can only be granted directly in the database (see [Day to day](day-to-day.md#making-someone-an-admin)), and the sign-up form can't set it.
- **The live site won't start without a strong `BETTER_AUTH_SECRET`**, so it can never run with a forgeable default.

### Bot check (Cloudflare Turnstile): **on** since 31 Oct 2026
- Covers sign-up, sign-in, password reset and resending the confirmation email, in both our forms *and* the login system's public web addresses (so bots can't skip the form and call those directly).
- Most people see nothing, or a box that ticks itself. Cloudflare only asks for a click when something looks off (automated browsers always get asked).
- If Cloudflare can't be reached, the check **fails closed**: the attempt is refused rather than waved through.
- The widget is called **Groundswell** in Cloudflare → Turnstile, for the hostname `groundswell.hahnsolo.ca`, mode *Managed*.
- Previews and your PC use Cloudflare's published test keys, which always pass.

### Rate limits ("slow down" counters)
The counters are stored in the database, not in server memory. Vercel runs many short-lived copies of the app, and in-memory counters would reset constantly. Database counters are shared and survive restarts. They also count correctly when many people arrive at the same moment (#103). Before that, a group starting together could get someone wrongly told "too many."

| Action | Limit |
|---|---|
| Sign in | 200 per 15 min per network address, **and** 10 per 15 min per account (stops password guessing spread across many addresses) |
| Sign up | 100 per hour per network address |
| Sign in or sign up by calling the login system's public addresses directly, skipping our forms | 20 per 15 min and 10 per hour per network address |
| Google and Apple buttons | 100 per minute per network address |
| Password reset | 5 per hour per network address, 3 per hour per email |
| Resend confirmation email | 3 per hour per account |
| Report content | 20 per hour per account |
| Representative lookup | 30 per hour per network address |
| Everything else in the login system | 100 per minute |

The sign-in and sign-up numbers are in `src/lib/auth-limits.ts`.

#### Why sign-in and sign-up allow so many from one address (#103)
Everyone on one wifi network usually shares one network address, and meetings and flyer sign-ups are how organizers grow a cause. The old limits (20 sign-ins, 10 sign-ups) would have turned away the 11th person signing up at a meeting. The new ones fit a room of 100: everyone can sign in with a retry each, or everyone can sign up. A form sent back for a typo or a short password doesn't count.

**The trade-off:** one address can now make 10 times as many attempts.

- **What stays the same:** guessing one person's password. That's still 10 tries per account per 15 minutes, however many addresses the guesses come from. That's up to 960 tries a day against one account, which is why passwords must be at least 10 characters.
- **What gets easier:** trying one common password against many different accounts. One address can make up to 19,200 sign-in attempts a day, up from 1,920. The per-account limit doesn't catch this, because each account only gets one try. **The bot check is now the main thing stopping it:** every attempt needs a fresh pass. If Turnstile were ever turned off or got beaten, this limit alone wouldn't hold.
- **What else gets easier:** creating fake accounts. One address can make up to 2,400 a day, up from 240. Each needs a bot-check pass and a confirmed email before it can post, and each uses one of the day's confirmation emails.
- **To keep the risk down:** the per-account check now comes after the bot check, so a script can't lock people out of their accounts without passing it each time. The login system's public addresses stay at the old low limits, because they have no per-account limit and our forms don't use them.

**What still blocks a room:**

- **More than about 100 people at once on one address.** They're told it can happen on shared wifi, and to switch to mobile data or wait up to 15 minutes (sign-in) or an hour (sign-up). One person running a script on the same network could also use up the allowance for everyone there.
- **The daily email allowance.** Brevo and Resend's free plans together send about 400 emails a day, and every new account gets a confirmation email. Past that, sign-up still works: the person is signed in and can read and join, a banner says their link is delayed, and the daily job sends it (#105). They can't post until they confirm. The job uses at most half the day's allowance, so the rest stays free for password resets and new sign-ups. A password reset that can't be sent isn't retried: the person still sees the usual "on its way" message, so they'd need to ask again later.
- **Password resets** (5 per hour per address). Those send email too, so they weren't raised.

### Posting rules
| | Established accounts | New accounts (first 24 hours) |
|---|---|---|
| Causes | 10/hour | 2/hour |
| Comments | 60/hour | 10/hour |
| Meetups | 10/hour | 2/hour |
| Campaigns | 5/hour | 1/hour |
| Links in a post | up to 3 | **none** |

Almost all spam comes from brand-new accounts posting links, so new accounts are held back for their first day. Real neighbours rarely notice. Also:

- **Honeypot:** every form has a hidden "website" field that people never see. Simple bots fill in every field, so if it's filled in, the post is quietly refused.
- **Duplicate messages** (same text from the same person within 10 minutes) are refused. That catches double-clicks and copy-paste bots.
- **Everything posted is checked** for sensible lengths and formats before it's saved. For example, a cause title is 8–120 characters and descriptions are capped at 5,000.

### Community moderation
- Members with a confirmed email can report causes, comments and announcements.
- **3 reports** from accounts **older than a day** hide the content automatically until an admin decides. Only older accounts count, so someone can't make three throwaway accounts to silence a person they disagree with.
- Admins review everything at `/admin/reports` (see [Day to day](day-to-day.md#using-the-moderation-queue)). Each decision is recorded.
- **Removing is undoable for a week.** Removed content is hidden from everyone but its author, who sees a notice with the moderator's reason. After 7 days a daily job deletes it for good, so people's words aren't kept longer than needed.
- Removed content can't be reported again, and nothing new (comments, meetups, campaigns) can be added to a removed Cause.
- **Leaders moderate their own cause (#71).** The people leading a cause can hide a chat message (it also files a report) and remove someone from the cause with a reason (they can't rejoin, sign or RSVP there, and are told why). They can't do this to moderators or co-leaders. Every action is in **What leaders did** at `/admin/reports`, where an admin can undo it. Someone removed can't create events or campaigns there either, and a leader's Unhide can't override a hide from community reports.
- **Enforced on the server (#97).** Nobody can join, RSVP or sign on a closed, hidden or removed cause, whatever the page shows, and a hidden cause can't post announcements.
- **Announcements are moderated (#97).** They're reported and auto-hidden like anything else. Removing or hiding one also deletes it from people's notifications; a push already sent can't be recalled.

### Privacy
- Only the coarse area is stored (Canadian FSA like `M5V`, or a US ZIP), never a street address.
- The full postal code used for the representative lookup is passed to Open North and **not stored**.
- The search-engine tag on the admin page says "don't index."
- **People can delete their account** from `/me` (password required). They're signed out everywhere and shown as "Former member"; after a 30-day grace period (signing in undoes it) their name, email, password and home area are erased for good. Their posts stay so discussions still make sense. See [Day to day](day-to-day.md#deleted-accounts).
- **People can take things back:** remove a campaign signature, cancel an RSVP, or **Leave** a cause to undo all of it (membership, upcoming RSVPs, signatures) in one go.

### Browser-level protections
Every page is sent with standard security headers that stop other sites from embedding Groundswell in a hidden frame (a "clickjacking" trick), stop browsers from guessing file types, and turn off camera, microphone and location access. HTTPS is automatic through Vercel.

### Secrets
No secret is in the code or on GitHub. They're in `.env` (ignored by git) and Vercel's encrypted settings. See [Keys and secrets](keys-and-secrets.md).

## Still to do

In rough order of importance:

1. **Turn on 2-step verification (2FA) on every account:** GitHub, Vercel, Neon, Resend, GoDaddy, Cloudflare, and Google/Apple if used. Whoever gets into GitHub or Vercel controls the site; GoDaddy controls your domain *and* your email. Use an authenticator app rather than text messages where offered, and save the backup codes somewhere safe.
2. **Add `CRON_SECRET` in Vercel** (before or with the next deploy), so the daily job that deletes removed content can run. See [Keys and secrets](keys-and-secrets.md).
3. **Make your own account an admin** on the live site (see [Day to day](day-to-day.md#making-someone-an-admin)), so someone is watching the moderation queue.
4. **Legal pages:** terms of use, a privacy policy (what's stored, why, and how to get it deleted; Canada's PIPEDA applies), and a code of conduct that says what gets removed. Link them from the sign-up page and footer.
5. **Later, if spam gets through anyway:** a "report user" feature, admin tools to suspend an account, and tightening DMARC from `p=none` to `p=quarantine` once you've seen that all legitimate email passes.
