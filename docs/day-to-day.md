# Day to day

How to run Groundswell on your PC, make a change, get it live, and look after the site.

## Running it on your PC

You need [Node.js](https://nodejs.org) installed and a `.env` file in the project folder, pointing at the Neon **dev** branch (see [Keys and secrets](keys-and-secrets.md)).

Open a terminal in the `groundswell` folder and run:

```bash
npm install
```

(Only needed the first time, or after the list of packages changes.)

```bash
npm run dev
```

Then open http://localhost:3000. Try ZIP `90210` or postal code `M5V` to see demo Causes.

- **Demo accounts** are listed at the top of `prisma/seed.ts`. The first one (`alex@demo.test`) is an admin, so you can see the moderation queue. They only exist in the dev database.
- **Emails don't get sent** on your PC. They're printed in the terminal where `npm run dev` is running, so you can click the confirm or reset link from there.
- **On your phone:** `npm run dev:lan` lets other devices on your home Wi-Fi connect (using your PC's network address). Plain `npm run dev` only answers on this computer, which is safer when you're on public Wi-Fi.
- To stop the server, press `Ctrl+C` in the terminal.

Other handy commands:

| Command | What it does |
|---|---|
| `npm test` | Runs the automated tests (spam rules, postal codes, moderation timing) in a few seconds |
| `npm run typecheck` | Checks the code for type mistakes without running it |
| `npm run lint` | Checks for common code problems |
| `npm run db:studio` | Opens a spreadsheet-like view of the **dev** database in your browser |

## Making a change

1. Edit the code (or ask Claude to).
2. Check it on http://localhost:3000.
3. Run `npm test`, `npm run typecheck` and `npm run lint`. If any of them complains, fix it first. Vercel would fail the build anyway on type or lint errors, and a failing test means a rule stopped working the way it should.
4. **Commit** the change (save a snapshot with a short description). Use GitHub Desktop: tick the files, write a summary, click **Commit to main**. (Git isn't on the command line on this PC. Claude uses GitHub Desktop's built-in copy.)
5. **Push** (GitHub Desktop → **Push origin**). That's the moment it goes live, see below.

### If the change touches the database structure

If `prisma/schema.prisma` changed (a new table or column), create a migration on the dev database first:

```bash
npm run db:migrate
```

It asks for a name (e.g. `add-cause-photos`), creates a file in `prisma/migrations/`, and applies it to dev. Commit that file with the code. The live database gets the same change automatically on the next deploy.

## How push-to-deploy works

```
 you push to main on GitHub
        │
        ▼
 Vercel notices (within seconds) and starts a build:
   1. npm install                 (gets the packages)
   2. prisma migrate deploy       (applies any new database changes to the LIVE database)
   3. next build                  (builds the site)
        │
        ├── build fails → the old version stays live. Nothing breaks for visitors.
        │
        └── build succeeds → the new version replaces the old one instantly.
```

The order matters: the database is updated *before* the new code goes live, so the new code never runs against an old database. This is the `vercel-build` script in `package.json`.

Pushing to any branch other than `main` gives you a **preview deployment** with its own private `…vercel.app` address. It's handy for trying something without touching the live site. Note that previews use whatever environment variables are set for "Preview" in Vercel.

## Checking a deploy

1. Vercel → project `groundswell` → **Deployments**. The newest is at the top: *Building* → *Ready* (good) or *Error* (bad).
2. Click a deployment → **Build Logs** to see what happened. A failure usually says why near the bottom.
3. Open https://groundswell.hahnsolo.ca and click around: the home page, an area, sign in.
4. If something's wrong after it went live: **Deployments** → find the previous good one → **⋯ → Promote to Production** (an instant rollback). Then fix the code calmly.
5. For errors while the site runs (not during the build): the deployment → **Logs** (or project → **Logs**). Messages like "Email send failed" or "MAIL_FROM is missing or malformed" show up here.

## Reseeding the dev database

Reseeding wipes the **dev** database and fills it with fresh demo data. It's useful when you've made a mess while testing.

```bash
npm run db:seed
```

It also resets the sign-in and posting rate limits, which is handy if testing has made the dev site tell you to slow down. It only works when your `.env` has `ALLOW_DB_SEED="yes"`, and it refuses to run on Vercel or in production. The live database can't be seeded by accident. If you just created the dev database, or a new migration came in, run `npm run db:deploy` first so the tables exist.

## Making someone an admin

Admins can see the moderation queue at `/admin/reports`. There's deliberately no button for this in the app. It's done directly in the database, so nobody can make themselves an admin through the website.

1. The person signs up on the live site and confirms their email.
2. Go to Neon → project → **SQL Editor**.
3. **At the top, pick the `main` branch** (the live data). The editor remembers the last branch you used, so check it every time.
4. Run (with their real email):

   ```sql
   UPDATE "User" SET "isAdmin" = true WHERE email = 'person@example.com';
   ```

   It should say **1 row** updated. If it says 0, check the spelling and the branch.
5. It takes effect on their next page load.

To remove admin, run the same thing with `false`.

To check who's an admin:

```sql
SELECT name, email FROM "User" WHERE "isAdmin" = true;
```

(The quotes around `"User"` and `"isAdmin"` are needed because the names have capital letters.)

On your PC you can do the same with `npm run db:studio` → `User` table → tick `isAdmin` → **Save**. That changes the **dev** database only.

## Using the moderation queue

Any member with a confirmed email can **report** a cause or a comment. Reports go to **https://groundswell.hahnsolo.ca/admin/reports** (admins only; everyone else gets a "page not found").

- Items are sorted by how many reports they have, with the most first. You'll see the content, who wrote it (name and email), and the reasons people gave.
- An item marked **Hidden** got 3 or more reports from accounts older than a day, so it was hidden automatically until you decide.
- For each item, choose:
  - **Keep & dismiss reports** (or **Restore** if hidden): the content stays or comes back, and the reports are closed.
  - **Remove cause / Remove message:** the content disappears for everyone except its author. You can type an optional reason first; the author sees it. Removing a cause also hides everything under it (comments, meetups, campaigns).
- **Removed isn't gone yet.** For **7 days**, removed content is listed under **Recently removed** at the bottom of the page, with a **Restore** button in case it was a mistake. During that week the author sees a "A moderator removed this…" notice with your reason and the date it will be deleted.
- **After 7 days it's deleted for good** by a daily clean-up job (see below). Deleting a cause also deletes its comments, meetups and campaigns. That part can't be undone.
- Every decision is recorded on the reports: who decided, when, and what (kept, removed or restored).

### The daily clean-up job

Once a day (around 9:00 UTC), Vercel calls `/api/cron/daily`, which:

1. permanently deletes anything a moderator removed more than **7 days** ago, and
2. anonymizes accounts that were deleted more than **30 days** ago (see [Deleted accounts](#deleted-accounts) below).

You can see each run in Vercel → project → **Settings → Cron Jobs**, and its log line ("Daily clean-up: purged N removed cause(s)… anonymized N deleted account(s)") in **Logs**. It only runs on the live site, and only if `CRON_SECRET` is set in Vercel (see [Keys and secrets](keys-and-secrets.md)). Without it, the job refuses to run and logs a warning.

The two numbers live in the code: `REMOVAL_RETENTION_DAYS` in `src/lib/moderation.ts` and `ACCOUNT_GRACE_DAYS` in `src/lib/accounts.ts`.

## Deleted accounts

Members delete their own account from `/me` → **Delete my account…** (they confirm with their password). What happens:

- **Straight away:** they're signed out everywhere. Their name shows as **"Former member"** on everything they posted. Their campaign signatures and RSVPs to upcoming meetups are removed. Meetups they were hosting pass to the next person going, or are cancelled if nobody else is. Their "I care" supports stay as anonymous counts.
- **For 30 days:** signing back in restores the account (they see a "Welcome back" note). Removed signatures and RSVPs don't come back.
- **After 30 days:** the daily job erases their name, email, password, home area and sign-in links. Their posts stay, credited to "Former member", and their email becomes free to sign up again.

**If someone emails asking to be deleted** and can't do it themselves, look them up in Neon's SQL Editor (main branch) and set the date. The daily job does the rest after 30 days:

```sql
UPDATE "User" SET "deactivatedAt" = now() WHERE email = 'person@example.com';
```

That doesn't sign them out or hand over their meetups the way the button does, so prefer the button where possible.

Tips: read the whole thread before removing something. Disagreement isn't abuse. Keep a removal for spam, harassment, personal information about someone, or illegal content. The site needs published rules so people know where the line is (see [Security and spam](security-and-spam.md#still-to-do)).
