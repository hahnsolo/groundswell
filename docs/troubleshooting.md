# Troubleshooting

Lessons from the first setup night, plus where to look when something goes wrong.

**First place to look, almost always:** Vercel → project `groundswell` → **Logs**. The app writes a plain-English message there when something fails.

---

## Emails fail to send

**Symptom:** sign-up or "forgot password" says *"We couldn't send the email. Please try again shortly."* and nothing arrives.

**What happened during setup:** `MAIL_FROM` in Vercel was slightly malformed (a missing `<` or `>`, stray quote marks, or a space in the wrong place). Resend rejected every email with a vague error, so it looked like a Resend problem when it was really a typo.

**What changed:** the app now checks `MAIL_FROM` before sending. If it's wrong, Vercel's logs say exactly that: `MAIL_FROM is missing or malformed: "…"`.

**How to fix it:**
1. Check Vercel → **Logs** for `MAIL_FROM is missing or malformed` or `Email send failed`.
2. Check **Resend → Logs** (sometimes called **Emails**). Every attempt is listed there with its status, and a failed one shows Resend's actual reason (bad "from" address, domain not verified, daily limit reached, and so on).
3. In Vercel → Settings → Environment Variables, `MAIL_FROM` should be exactly:
   `Groundswell <no-reply@groundswell.hahnsolo.ca>`
   With no quote marks around it (Vercel stores the value as-is), angle brackets around the address, and a domain that matches the one verified in Resend.
4. Redeploy after changing it.

Other causes, in Resend's logs:
- **Domain not verified:** a DNS record was changed or removed. See [DNS](dns.md).
- **Rate or daily limit:** the free plan is about 100 emails a day.
- **Arrives in spam:** check the DMARC/DKIM records in [DNS](dns.md). New sending domains also take a little while to build trust.

## The live site was using the dev database

**Symptom:** the live site showed the demo issues and demo accounts, or things you posted on the live site appeared on your PC.

**What happened:** Neon's **Connect** box remembers the **last branch you picked**. After copying the `dev` connection strings for the PC, opening Connect again to get the "live" strings silently gave the `dev` ones again, and those went into Vercel.

**How to tell which database something is using:** every Neon branch has its own **endpoint ID**, which looks like `ep-` followed by a few words and letters. It's in the connection string's host name, after the `@`:

```
postgresql://user:••••••@ep-something-words-123456-pooler.us-east-2.aws.neon.tech/neondb?...
                         └──────────── endpoint ID ────────────┘
```

1. In Neon → **Branches**, click `main` and `dev`. Each shows its endpoint ID. Note which is which.
2. In Vercel → Environment Variables, reveal `DATABASE_URL` and `DIRECT_URL` and read just the `ep-…` part. **Both must match `main`.**
3. In your `.env`, both must match `dev`.

You only need to look at the `ep-…` part. Don't copy or paste the whole string anywhere, since it contains the password.

**How to fix it:** Neon → **Connect** → in the **Branch** dropdown, *deliberately* select `main` → copy the pooled string (add `&pgbouncer=true`) and the direct string → paste into Vercel → redeploy. The first deploy against an empty `main` creates the tables automatically.

**Rule from now on:** every time you open Neon's Connect box or SQL Editor, look at the branch picker first.

## The first page load after a quiet spell is slow

**Symptom:** after nobody has visited for a while, the first page takes a few seconds (sometimes up to ~5) to load. After that it's fast.

**Why:** on Neon's free plan the database **goes to sleep** after about 5 minutes with no activity, and wakes up on the next request. That waking up is a "cold start." Vercel's servers do something similar on their own. This is normal, and it's the trade-off for paying $0.

**What's already done to help:**
- The servers run in Cleveland, right next to the database in Ohio, so every request after wake-up is quick.
- Pages show their outline straight away and fill in the data as it arrives, so the site doesn't look frozen.

**If it becomes a problem:** Neon's paid plans let you turn sleep off ("scale to zero" setting). Don't set up an outside service to ping the site every few minutes to keep it awake: it uses up the free compute allowance and could tip you onto a bill.

**Rare related error:** a page fails once with a database timeout right after a long quiet spell. Refreshing fixes it. If it happens often, check Neon → **Monitoring** and whether you've hit the free compute limit for the month.

---

## Quick checks for other problems

| Symptom | Look at |
|---|---|
| Site shows an old version | Vercel → Deployments: did the latest build fail? A failed build leaves the previous version live. |
| Build fails at `prisma migrate deploy` | `DIRECT_URL` in Vercel is wrong or the database is unreachable. Check the endpoint ID (above) and Neon's status page. |
| Site won't start: "BETTER_AUTH_SECRET must be set…" | The secret is missing or too short in Vercel. Generate one (see [Keys and secrets](keys-and-secrets.md)) and redeploy. |
| `groundswell.hahnsolo.ca` doesn't load at all, or certificate warning | The `groundswell` CNAME in GoDaddy (see [DNS](dns.md)) and Vercel → Settings → Domains, which should say *Valid Configuration*. |
| "We couldn't reach the postal code service" | zippopotam.us is down. It's temporary; codes already looked up still work. |
| Representative lookup unavailable | Open North's Represent service is down. Temporary. |
| Everyone got signed out | Someone changed `BETTER_AUTH_SECRET`. That's expected after rotating it. |
| `npm run db:seed` says "Refusing to seed" | Working as intended: it only runs against dev with `ALLOW_DB_SEED="yes"` in `.env`. |
| Locally: confirmation email never arrives | On your PC, emails aren't sent. Look in the terminal running `npm run dev` for the link. |
