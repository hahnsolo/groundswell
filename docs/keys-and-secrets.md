# Keys and secrets

The app reads its settings from **environment variables**: named values like `APP_URL` that live outside the code. That way the code can be public on GitHub while the passwords stay private.

There are two places they live:

- **On your PC:** a file called `.env` in the project folder. Git ignores it (see `.gitignore`), so it's never uploaded. `.env.example` is the template, with names and comments but no real values.
- **On the live site:** Vercel → project `groundswell` → **Settings → Environment Variables**. Vercel keeps them encrypted and gives them to the app when it runs.

After changing a variable in Vercel, you must **redeploy** for it to take effect (Vercel → **Deployments** → the latest one → **⋯ → Redeploy**).

**Secret vs config.** A *secret* is like a password: anyone who has it can pretend to be us, read the database, or send email as us. Never paste one into chat, code, a screenshot or a GitHub issue. *Config* is just a setting; it's not dangerous if seen.

**Anything starting with `NEXT_PUBLIC_`** is deliberately sent to every visitor's browser. Only non-secret values go in those.

## The list

| Variable | What it is | Secret? | Your PC (`.env`) | Vercel (live) |
|---|---|---|---|---|
| `DATABASE_URL` | Address + password for the database, via Neon's "pooler" (which handles lots of short connections) | **Secret** | Neon **dev** branch | Neon **main** branch |
| `DIRECT_URL` | Same database, direct connection. Only used when changing the database structure. | **Secret** | Neon **dev** branch | Neon **main** branch |
| `ALLOW_DB_SEED` | Lets `npm run db:seed` wipe and refill the database with demo data | Config | `yes` | **Never set** |
| `APP_URL` | The site's public address, used in emailed links, share links and sign-in callbacks | Config | `http://localhost:3000` | `https://groundswell.hahnsolo.ca` |
| `BETTER_AUTH_SECRET` | Signs login sessions so they can't be forged | **Secret** | Its own random value | A **different** random value |
| `CRON_SECRET` | Lets only Vercel run the daily clean-up job (deletes removed content after 7 days, anonymizes deleted accounts after 30) | **Secret** | Optional (only for testing the job) | **Set** (needed for the job to run) |
| `RESEND_API_KEY` | Lets the app send email through Resend | **Secret** | Leave unset (emails print in the terminal instead) | Set |
| `MAIL_FROM` | Who emails come from: `Groundswell <no-reply@groundswell.hahnsolo.ca>` | Config | Not needed | Set |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Turnstile's public key, shown to browsers (not a secret) | Config (public) | Optional; Cloudflare's test key | Set (previews: Cloudflare's test key) |
| `TURNSTILE_SECRET_KEY` | Turnstile's private key, used to check answers | **Secret** | Optional; Cloudflare's test key | Set (previews: Cloudflare's test key) |
| `CHAT_URL` | Address of the live chat server on Cloudflare (see [Live chat](live-chat.md)) | Config | `http://localhost:8787` | Set (previews: the preview chat server) |
| `CHAT_SECRET` | Shared with the chat server; signs chat passes and announcements. Must match the chat server's own `CHAT_SECRET` | **Secret** | `local-dev-chat-secret` | Set, a different value for previews |
| `GOOGLE_CLIENT_ID` | Identifies our app to Google | Config | Optional | Optional |
| `GOOGLE_CLIENT_SECRET` | Proves to Google it's really us | **Secret** | Optional | Optional |
| `APPLE_CLIENT_ID` | Our Apple "Services ID" | Config | Optional | Optional |
| `APPLE_TEAM_ID` | Your Apple developer team ID | Config | Optional | Optional |
| `APPLE_KEY_ID` | ID of the Apple sign-in key | Config | Optional | Optional |
| `APPLE_PRIVATE_KEY` | The contents of Apple's `.p8` key file | **Secret** | Optional | Optional |
| `APPLE_APP_BUNDLE_ID` | Only needed if there's ever an iPhone app | Config | — | — |

Why some settings have safety nets built into the code:

- **`BETTER_AUTH_SECRET`:** the live site refuses to start if it's missing or shorter than 32 characters, so it can never run with a guessable default.
- **`ALLOW_DB_SEED`:** the seed script deletes everything and creates a demo admin with a public password. It refuses to run unless this says `yes`, and it also refuses if it detects it's running on Vercel or in production. That's two locks, so it can't hit the live database by accident.
- **`RESEND_API_KEY`:** on the live site, missing it is an error (people would never get their emails). On your PC, emails are printed in the terminal instead.
- **`MAIL_FROM`:** checked for the right shape before sending, because a typo here once caused confusing failures (see [Troubleshooting](troubleshooting.md#emails-fail-to-send)).
- **`CRON_SECRET`:** without it, the clean-up job refuses to run (rather than running unprotected, where anyone could trigger it), and logs "CRON_SECRET is not set".
- **Turnstile, Google, Apple:** each feature switches itself on only when its keys are present, so nothing breaks before you've set them up.

## How to rotate (replace) each one

"Rotating" means making a new key and retiring the old one. Do it if a secret might have leaked (pasted somewhere, shown on screen, laptop lost), or just as routine hygiene once a year.

General pattern: **make the new one → put it in Vercel → redeploy → check the site works → delete the old one.**

### Database (`DATABASE_URL`, `DIRECT_URL`)
1. Neon → project → **Branches** → pick the branch (`main` for live, `dev` for your PC) → **Roles** → the database user → **Reset password**.
2. Neon → **Connect** → choose that same branch → copy the new pooled and direct strings. (**Check the branch picker!** See [Troubleshooting](troubleshooting.md#the-live-site-was-using-the-dev-database).) Add `&pgbouncer=true` to the end of the pooled one.
3. For `main`: paste both into Vercel and redeploy. For `dev`: paste both into your `.env` and restart `npm run dev`.
4. The old password stops working the moment you reset it, so the live site is briefly broken between steps 1 and 3. Have Vercel open and ready first.

### `BETTER_AUTH_SECRET`
1. Generate a new one in a terminal:
   `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`
2. Paste it into Vercel (or `.env`) and redeploy.
3. Side effect: **everyone is signed out** and has to sign in again. Their accounts and passwords are unaffected.

### `CRON_SECRET`
1. Generate a new value with the same command as `BETTER_AUTH_SECRET` above.
2. Paste it into Vercel and redeploy. Vercel automatically sends it when it runs the daily job, so there's nothing else to update.
3. No side effects for visitors.

### `RESEND_API_KEY`
1. Resend → **API Keys → Create API Key**. "Sending access" for just the `groundswell.hahnsolo.ca` domain is enough.
2. Put it in Vercel and redeploy.
3. Test it: use "Forgot password" on the live site with your own email.
4. Delete the old key in Resend.

### Turnstile keys
Cloudflare → **Turnstile** → the widget → **Rotate secret key**. Put the new secret in Vercel and redeploy. The site key normally stays the same.

### Google
Google Cloud Console → **APIs & Services → Credentials** → the OAuth client → **Add secret**. Update `GOOGLE_CLIENT_SECRET` in Vercel, redeploy, test, then disable the old secret.

### Apple
Apple Developer → **Keys** → create a new Sign in with Apple key → update `APPLE_KEY_ID` and `APPLE_PRIVATE_KEY` → redeploy → revoke the old key. (The app signs Apple's short-lived token itself at startup, so there's no six-month renewal to remember.)

## Rules of thumb

- Your PC and the live site always use **different** values for the database and `BETTER_AUTH_SECRET`.
- Never commit `.env`. If git ever lists `.env` as a change, stop and ask.
- If a secret is ever pasted into a chat, email or commit, rotate it. Deleting the message isn't enough.
