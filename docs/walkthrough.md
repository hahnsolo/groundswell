# Walkthrough: every page, with pictures

A tour of Groundswell from a visitor's point of view: what each page is for, what people can do there, and the rules working behind it.

The screenshots come from the **dev site with demo data** (Alex, Sam and Priya are made-up accounts from `prisma/seed.ts`). The live site looks the same, just with real posts.

**Contents**

1. [Home page](#1-home-page)
2. [Area page: issues near you](#2-area-page-issues-near-you)
3. [Issue page](#3-issue-page): the heart of the app
   - [Support, share, status](#support-share-and-status)
   - [Discussion](#discussion)
   - [Meetups](#meetups)
   - [Campaigns and the letter builder](#campaigns-and-the-letter-builder)
   - [Find your representatives](#find-your-representatives)
4. [Raise an issue](#4-raise-an-issue)
5. [Join, sign in, forgot password](#5-join-sign-in-and-forgot-password)
6. [Your activity (`/me`)](#6-your-activity-me), including [deleting your account](#deleting-your-account)
7. [Reporting and the moderation queue (admins)](#7-reporting-and-the-moderation-queue-admins)
8. [On a phone, and installing the app](#8-on-a-phone-and-installing-the-app)
9. [Small pages: not found, offline](#9-small-pages)
10. [Who can do what: summary table](#10-who-can-do-what)

---

## The top bar (on every page)

- **The wave logo and "Groundswell"** go back to the home page.
- **Your neighbourhood** (e.g. "Downtown Toronto ▾"): the last area you looked at, or your home area. Click it to jump back there or look up another postal code. It's remembered in a small cookie that holds only the area code and its name.
- **+ Start something** (red, the one loud button) raises a new issue in the neighbourhood you're looking at. On a phone it's just a **+**.
- **Signed out:** **Sign in** and **Join**.
- **Signed in:** a circle with **your initial**, which goes to your activity page. **Sign out** is at the top of that page.
- **Email not confirmed yet:** a yellow bar under the top bar says *"Confirm your email (…) to post issues, comments and meetups"*, with a button to resend the link (at most 3 times an hour).

---

## 1. Home page

`/`

**First visit:** a short welcome and a postal code box.

![Home page on a first visit](images/walkthrough/01-home.webp)

**Coming back:** once you've looked at a neighbourhood (or set a home area), the home page opens straight onto it: what's going on around there right now, recent wins, and the top causes.

![Home page for a returning visitor](images/walkthrough/01b-home-returning.webp)

**What you can do:**
- **First visit:** pick **United States** or **Canada**, type a ZIP or postal code, and press **Find my community**. That takes you to the area page.
- **Coming back:** open any cause, see a recent win, use **See everything around …** for the full list, or look up **somewhere else** at the bottom.

**Behind the scenes:**
- Only the first part of a code is kept: the first 3 characters of a Canadian code (`M5V 2T6` → `M5V`) or the 5-digit ZIP. That's enough to find "nearby" without pinpointing anyone's home.
- "Your neighbourhood" is the last area you looked at, remembered in a small cookie holding only the area code and name. If you're signed in and haven't looked anywhere yet, it's your home area.
- Invalid codes get a friendly error rather than an empty page.

---

## 2. Area page: what's going on around a neighbourhood

`/area/ca/m5v`, `/area/us/90210`, …

![Area page for Downtown Toronto](images/walkthrough/02-area.webp)

**What it's for:** the neighbourhood's noticeboard: every cause nearby, with who's involved and what's happening.

**At the top:** *"What's going on around Downtown Toronto,"* then the neighbourhood's pulse: how many neighbours are involved, events in the next 7 days, and wins in the last 30 days.

**Recent wins:** causes marked resolved in the last 30 days get their own green cards up front. Wins are the proof that working together works, so they're celebrated, not buried.

**What you can do:**
- **Filter by topic** with the tabs: Everything, Safety, Roads & transit, Housing, Environment, Parks & recreation, Schools & youth, Health, Local business, Utilities & services, Other.
- **Change the distance:** 2, 5, 10 (default), 25 or 50 km.
- **Show:** *Most support* (resolved causes sink to the bottom) or *Newest*.
- **+ Raise an issue here** (or **Start something** in the top bar) starts a new one for this area.
- Visiting an area makes it "your neighbourhood" in the top bar and on the home page.
- Click any card to open the cause.

**Reading a card:** the small line on top gives the topic, place and distance. On the right is what's happening **now**, picked in this order:

| Label | When |
|---|---|
| **✓ Won** | The person who raised it marked it resolved |
| **Meeting Wed, Oct 28** | A meetup is coming up in the next two weeks (shown in your time zone) |
| **Asking · 48 of 150 signed** | It has a campaign |
| **3 joined this week** | New people cared in the last 7 days |
| **New** | Raised in the last week |
| **Being worked on** | Its author set that status and none of the above applies |

Under the title: the first few people's initials and a line like *"Priya, Sam and 12 neighbours care,"* plus how many messages it has. People who've deleted their account are counted but never named.

**Behind the scenes:**
- The first time anyone looks up a code, the app asks a free service (zippopotam.us) where it is, then remembers the answer, so each code is only looked up once.
- If nothing is nearby, the page suggests looking further out or being the first to raise something.
- Issues hidden by reports or removed by a moderator never appear here.
- The moment a cause is marked resolved is recorded, so wins can be shown for 30 days (and, later, on a progress tracker).

---
## 3. Issue page

`/issues/…`

This is where neighbours actually work together. Everyone can read it; you need to be signed in to take part.

**Signed out:** everything is visible, and the action areas say *"Sign in to join the discussion / RSVP / sign / start a campaign."*

![Issue page, signed out](images/walkthrough/03-issue-signed-out.webp)

**Signed in** (here as Sam, who supports this issue, is going to the meetup and has signed the campaign):

![Issue page, signed in as Sam](images/walkthrough/07-issue-signed-in.webp)

### Support, share and status

- **I care about this** adds your support (the number goes up). It becomes **✓ I care** once you've clicked it; hovering over it then says **Remove my support**, and clicking takes it back. This one doesn't need a confirmed email.
- **Share** opens your phone's share sheet, or copies the link on a computer.
- **Status:** only the person who raised the issue sees buttons to change it between *Open*, *Being worked on* and *Resolved*. Everyone else sees **Report this issue** there instead (see [section 7](#7-reporting-and-the-moderation-queue-admins)).
- **Leave this issue:** once you've supported, RSVP'd or signed something here, a small **Leave this issue** link appears. It undoes all of that in one go: your support, your RSVPs to its upcoming meetups, and your campaign signatures. Your comments stay, since they're part of the conversation. If you were hosting one of its meetups, it's handed on (see below).

![Leave this issue, opened](images/walkthrough/20-leave-issue.webp)

### Discussion

- A simple conversation in time order. The issue's author is marked **AUTHOR**.
- Type in the box and press **Post comment**.
- Hovering over someone else's comment shows a **Report** link.

**Rules:** a confirmed email is needed to post. New accounts (first 24 hours) can post 10 comments an hour and no links; established accounts can post 60 an hour with up to 3 links. Posting the same text twice within 10 minutes is refused ("You just posted that.").

### Meetups

Each meetup shows the date and time **in your own time zone**, the place (or "Online"), who's hosting, how many are going, and an **RSVP** button (it becomes **✓ Going**, or **Full** if there's a capacity and it's reached).

Click **+ Organize a meetup** to open the form:

![Meetup form](images/walkthrough/08-meetup-form.webp)

- **Title, when, where** (a public place is suggested), an optional plan, and an optional **capacity**.
- Tick **Online meetup** and *Where* becomes *Video link*. **The link is only shown to people who've RSVP'd**, so random visitors can't drop into the call.
- The organizer is automatically marked as going, and sees **✓ Hosting** instead of an RSVP button.
- Only upcoming meetups are listed (and ones that started in the last 6 hours).

**Can't host it?** The host can open **Can't host it?** → **Step down as host**:

![Step down as host](images/walkthrough/21-step-down.webp)

- The meetup passes to **the first person who RSVP'd** (who still has an account). They get an email saying they're now hosting, with a link to step down themselves, which passes it to the next person.
- The meetup then shows *"hosted by Sam (took over)"*.
- If nobody else is going, the meetup is **cancelled**.
- The same handover happens when a host uses "Leave this issue" or deletes their account.

**Rules:** confirmed email needed; 10 meetups an hour (2 for new accounts); the time must be in the future.

### Campaigns and the letter builder

A campaign turns concern into a specific request to a specific decision-maker.

- **+ Start a campaign** asks three things: **who can fix this** (e.g. "City Council, Ward 4"), **what exactly you're asking for**, and a **signature goal** (default 100).
- Each campaign shows a progress bar (*2 of 150 signatures*), who started it, and up to 5 recent public notes from signers.
- **Add my name** signs it, with an optional public note on why it matters. You see **✓ You've signed this campaign** afterwards, with a **Remove my signature** link if you change your mind.
- **✉️ Write to …** opens the **letter builder**:

![Letter builder](images/walkthrough/09-letter-builder.webp)

Type your name (and the recipient's email if you have it). The app writes a polite letter that includes the issue, the exact ask, how many neighbours signed, and a link back to the issue. **Open in email** opens your own email app with it filled in, or **Copy letter** copies it. Groundswell itself never sends these emails; they come from the person's own email account.

**Rules:** confirmed email needed to start or sign (signature counts go to decision-makers, so each must be a real, confirmed person); 5 campaigns an hour (1 for new accounts).

### Find your representatives

- **Canada:** type a **full** postal code and press **Find** to get your MP, provincial representative, councillor and mayor, with a button to copy each email. The full postal code is passed to Open North's free "Represent" service and **not saved**. Limited to 30 lookups an hour per connection.

![Representative lookup for a Toronto postal code](images/walkthrough/12-rep-lookup.webp)

- **United States:** a link to usa.gov's official lookup, since there isn't a free nationwide equivalent.

---

## 4. Raise an issue

`/issues/new` (from **Start something** in the top bar, or **+ Raise an issue here** on an area page)

![Raise an issue form](images/walkthrough/10-new-issue.webp)

- **What's the issue?** A short, specific title (8–120 characters).
- **Category:** one of the ten.
- **Details:** what's happening, who it affects, and what a good outcome looks like (20–5,000 characters). The hint reminds people not to include anyone's private information.
- **Country and postal code:** filled in from the area you came from. Only the area is stored.
- **Post issue** creates it, counts the author as its first supporter, and opens the new issue page.

**Rules:** confirmed email needed; 10 issues an hour (2 for new accounts); new accounts can't include links.

---

## 5. Join, sign in and forgot password

| Join (`/signup`) | Sign in (`/signin`) |
|---|---|
| ![Join form](images/walkthrough/04-signup.webp) | ![Sign-in form](images/walkthrough/05-signin.webp) |

**Join** asks for a name (shown on posts; a first name is fine), email, a password of at least 10 characters, and an optional home area. Then:

1. The account is created and you're signed in straight away.
2. A **"Confirm your email"** message is sent (on your PC it's printed in the terminal instead). The link works for 48 hours.
3. Until you click it, you can browse, support issues and RSVP, but not post, sign or report. The yellow bar reminds you.

**Sign in** takes you back to the page you were on. After 10 wrong tries on one account (or 20 from one connection) within 15 minutes, it asks you to wait.

**Forgot password?** (`/forgot-password`) emails a reset link that works for 1 hour. It always answers *"If there's an account for that email, a reset link is on its way,"* whether or not the address is registered, so nobody can use it to find out who's a member. Setting a new password signs you out on every device.

![Forgot password](images/walkthrough/06-forgot-password.webp)

**Coming later:** once their keys are added, **Sign in with Google** and **Sign in with Apple** buttons appear on both forms automatically, and the Cloudflare "are you human?" check appears too (usually invisible). See [Security and spam](security-and-spam.md).

---

## 6. Your activity (`/me`)

Click your name in the top bar.

![Your activity page](images/walkthrough/11-me.webp)

- **Sign out** at the top right.
- **Home area:** set or change your postal code. The top bar falls back to it when you haven't looked at another area.
- **Upcoming meetups** you've RSVP'd to, with times in your time zone. **✕ Not going** cancels your RSVP. Meetups you host are tagged **Hosting**, with a **Manage** link to the meetup (stepping down is confirmed there).
- **Issues you raised.** If a moderator hid or removed one, it shows an **Under review** or **Removed** tag here.
- **Issues you support**, each with **✕ Stop supporting**.
- **Your account:** your sign-in email, and **Delete my account…** (below).
- **Admins also see** a **Moderation queue** box at the top with the number of open reports.

### Deleting your account

**Delete my account…** opens a plain explanation of what will happen, and asks for your password:

![Delete my account, opened](images/walkthrough/19-delete-account.webp)

After confirming, you're signed out everywhere and land on this page:

![Account deleted page](images/walkthrough/22-goodbye.webp)

- **Right away:** everything you posted shows **"Former member"** instead of your name. Your campaign signatures and upcoming RSVPs are removed, and meetups you were hosting are handed on or cancelled. Your "I care" clicks stay as anonymous numbers.
- **Changed your mind?** Sign in within **30 days** and the account comes back, with a "Welcome back" note. (Removed signatures and RSVPs aren't restored.)
- **After 30 days:** your name, email, password and home area are erased for good by the daily clean-up job. Your posts stay, so the conversations still make sense, and your email is free to sign up again.

---

## 7. Reporting and the moderation queue (admins)

### How reporting works

1. Any member with a confirmed email can click **Report** on an issue or a comment (not their own).
2. The report goes into the moderation queue. Up to 20 reports an hour per person.
3. If **3 different accounts that are over a day old** report the same thing, it's **hidden automatically** until an admin decides. The author still sees it, with a note that it's under review.

### The moderation queue

`/admin/reports`. Only admins can see it; everyone else gets "page not found." (How to make someone an admin: [Day to day](day-to-day.md#making-someone-an-admin).)

![Moderation queue with one reported comment](images/walkthrough/13-moderation-queue.webp)

Each reported item shows its type, number of reports, when it was first reported, the content and who wrote it, and the reporters' reasons. Then:

- **Keep & dismiss reports** (or **Restore** if it was auto-hidden): it stays, and the reports are closed.
- **Remove comment / issue:** optionally type a reason first (the author will see it), then click.

### After removing: undo for 7 days

![Recently removed list with a Restore button](images/walkthrough/14-recently-removed.webp)

Removed content moves to **Recently removed**, which shows when it was removed, when it will be deleted for good, the reason, and a **Restore** button.

Meanwhile, the **author** sees this under their removed comment (or at the top of a removed issue). Nobody else sees the content at all:

![What the author sees after a removal](images/walkthrough/15-author-removal-notice.webp)

After **7 days**, the daily clean-up job on Vercel deletes it permanently. Deleting an issue also deletes its comments, meetups and campaigns. Every decision (kept, removed, restored) is recorded with who did it and when.

---

## 8. On a phone, and installing the app

The whole site is designed to work on phones first:

<p>
<img src="images/walkthrough/16a-phone-home.webp" alt="Home page on a phone" width="300">
&nbsp;
<img src="images/walkthrough/16b-phone-issue.webp" alt="Issue page on a phone" width="300">
</p>

**Installing:** Groundswell can be added to a phone's home screen like an app (it's a "PWA"):

- **Android / Chrome / Edge:** a small "Get the Groundswell app" card appears at the bottom with an **Install** button.
- **iPhone (Safari):** the card explains *Share → Add to Home Screen*, since Apple doesn't allow a button.
- Dismiss it with ✕ and it won't come back on that device.

Installed, it opens full-screen with its own icon. It only stores the app's design files on the phone, never pages or anyone's data, so nobody sees stale or someone else's information.

---

## 9. Small pages

| Not found | Offline |
|---|---|
| ![Page not found](images/walkthrough/17-not-found.webp) | ![You're offline](images/walkthrough/18-offline.webp) |

- **Not found** appears for a mistyped address, a deleted or removed issue, or a non-admin trying `/admin/reports`.
- **You're offline** appears when the installed app is opened without a connection, instead of the browser's error page.

---

## 10. Who can do what

| Action | Visitor | Signed in | Email confirmed | Issue author | Admin |
|---|:-:|:-:|:-:|:-:|:-:|
| Browse areas, issues, meetups, campaigns | ✓ | ✓ | ✓ | ✓ | ✓ |
| Look up representatives | ✓ | ✓ | ✓ | ✓ | ✓ |
| "I care" support, RSVP | | ✓ | ✓ | ✓ | ✓ |
| Raise issues, comment, organize meetups, start campaigns | | | ✓ | ✓ | ✓ |
| Sign campaigns, report content | | | ✓ | ✓ | ✓ |
| Remove own support, signature, RSVP; "Leave this issue" | | ✓ | ✓ | ✓ | ✓ |
| Step down as a meetup's host | | ✓ (host) | ✓ (host) | ✓ (host) | ✓ (host) |
| Delete own account | | ✓ | ✓ | ✓ | ✓ |
| Change an issue's status | | | | ✓ | |
| See their own hidden/removed posts (with a notice) | | | | ✓ | |
| Moderation queue: keep, remove, restore | | | | | ✓ |

The posting limits, link rules and everything else that protects the site are explained in [Security and spam](security-and-spam.md).

---

*To refresh these screenshots after a design change: reseed the dev database (`npm run db:seed`), run the dev server, and retake the pictures at 1280 px wide (phones at 390 px). Save them as WebP in `docs/images/walkthrough/`, keeping the same file names.*
