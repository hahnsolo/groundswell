// Click-through checks of the main journeys: events, chat, signatures, stepping
// down as host, leaving a cause, deleting an account.
// Needs fresh demo data (`npm run db:seed`), because it changes it.
import assert from "node:assert/strict";
import { CONTEXT, PW, findCause, go, launch, settle, signIn } from "./helpers.mjs";

const browser = await launch();
const opts = { viewport: { width: 1280, height: 860 }, colorScheme: "light", ...CONTEXT };
const text = (page) => page.locator("main").innerText();
const waitText = (page, re) => page.waitForFunction((src) => new RegExp(src, "i").test(document.querySelector("main").innerText), re.source, { timeout: 30000 });
const step = (s) => console.log("✓", s);

let ISSUE;
{
  const page = await (await browser.newContext(opts)).newPage();
  ISSUE = await findCause(page, "/area/us/90046?radius=25", "No safe crossing");
  await page.context().close();
}

// 0. Events: nearby list, event page, RSVP toggle, calendar file.
{
  const page = await signIn(browser, "sam@demo.test", opts); // home area 90046, near the crossing cause
  await go(page, "/events");
  assert.match(await text(page), /Events around Los Angeles/);
  assert.match(await text(page), /Morning crossing count/);
  await page.getByText("Morning crossing count").first().click();
  await page.waitForURL(/\/events\/\w+/);
  await settle(page);
  const eventUrl = page.url();
  assert.match(await text(page), /Part of No safe crossing/);
  assert.match(await text(page), /Alex and Sam are going/);
  assert.match(await text(page), /✓ You're going/);
  await page.getByRole("button", { name: "✓ You're going" }).click();
  await waitText(page, /Alex is going/);
  await page.getByRole("button", { name: "I'll be there" }).click();
  await waitText(page, /Alex and Sam are going/);
  step("Event page: who's going, RSVP off and on");
  const ics = await page.request.get(`${eventUrl}/calendar.ics`);
  assert.equal(ics.status(), 200);
  assert.match(ics.headers()["content-type"], /text\/calendar/);
  assert.match(await ics.text(), /BEGIN:VCALENDAR[\s\S]*SUMMARY:Morning crossing count/);
  step("Add to calendar downloads a valid .ics file");
  // A fresh page load must show the time in the visitor's time zone, not the server's.
  await go(page, new URL(eventUrl).pathname);
  const shown = await page.evaluate(() => {
    const t = document.querySelector("main dl time");
    const expected = new Date(t.getAttribute("datetime")).toLocaleString(undefined, {
      weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit",
    });
    return { text: t.textContent, expected };
  });
  assert.equal(shown.text, shown.expected);
  step(`Times show in the visitor's time zone on a fresh load (${shown.text})`);
  await page.context().close();

  const anon = await (await browser.newContext(opts)).newPage();
  await go(anon, new URL(eventUrl).pathname);
  assert.match(await anon.locator("main").innerText(), /I'll be there/);
  await anon.getByRole("link", { name: "I'll be there" }).click();
  await anon.waitForURL(/\/signin\?next=%2Fevents%2F/);
  step("Signed-out visitors are sent to sign in, then back to the event");
  await anon.context().close();
}

// 1. Chat: Priya isn't a member of the crossing cause → can't see it; joins → read-only for 24 hours.
{
  const page = await signIn(browser, "priya@demo.test", opts);
  await go(page, `/issues/${ISSUE}/chat`);
  assert.match(await text(page), /The chat is for neighbours who.ve joined/);
  assert.doesNotMatch(await text(page), /My daughter crosses here/);
  step("Non-members can't see the chat");
  await page.locator("main").getByRole("button", { name: "Join this cause" }).first().click();
  await waitText(page, /You can post from/);
  assert.match(await text(page), /My daughter crosses here/);
  step("After joining: can read, can't post for 24 hours");
  await page.context().close();
}

// 2. Sam (member for over a week) posts in the chat, and Alex, who has the chat
//    open, sees it without reloading. Then Sam removes and re-adds a signature on About.
{
  const alex = await signIn(browser, "alex@demo.test", opts);
  await go(alex, `/issues/${ISSUE}/chat`);
  // E2E_EXPECT_LIVE=1 when the local chat server is running (cd realtime; npm run dev).
  const live = process.env.E2E_EXPECT_LIVE === "1";
  if (live) await alex.getByText("Live: new messages appear").waitFor({ timeout: 15000 });
  await alex.evaluate(() => (window.__notReloaded = true));

  const page = await signIn(browser, "sam@demo.test", opts);
  await go(page, `/issues/${ISSUE}/chat`);
  await page.getByLabel("Your message").fill("Counted 4 near-misses this morning.");
  const sentAt = Date.now();
  await page.getByRole("button", { name: "Send" }).click();
  await waitText(page, /Counted 4 near-misses this morning/);
  step("Members past the wait can post");

  await alex.waitForFunction(() => /Counted 4 near-misses this morning/.test(document.querySelector("main").innerText), null, {
    timeout: live ? 5000 : 30000,
  });
  assert.equal(await alex.evaluate(() => window.__notReloaded), true, "Alex's page reloaded instead of updating in place");
  step(`Another member sees the message without reloading (${((Date.now() - sentAt) / 1000).toFixed(1)}s, ${live ? "live" : "checking every 10s"})`);
  await alex.context().close();
  await go(page, `/issues/${ISSUE}`);
  assert.match(await text(page), /✓ Joined/);
  assert.match(await text(page), /2\s+of 150 signed/);
  await page.getByRole("button", { name: "Remove my signature" }).click();
  await waitText(page, /1\s+of 150 signed/);
  await page.getByRole("button", { name: "Add my name" }).click();
  await waitText(page, /2\s+of 150 signed/);
  step("Remove and re-add a signature on About");
  await page.context().close();
}

// 3. Alex steps down as host → Sam (earliest other RSVP) takes over.
{
  const page = await signIn(browser, "alex@demo.test", opts);
  await go(page, `/issues/${ISSUE}/events`);
  await page.getByText("Can't host it?").click();
  await page.getByRole("button", { name: "Step down as host" }).click();
  await waitText(page, /hosted by Sam\s*\(took over\)/);
  step("Step down: event now hosted by Sam (took over)");
  await page.context().close();
}

// 4. Sam leaves the cause → no longer joined, signature gone, the event with nobody left is cancelled.
{
  const page = await signIn(browser, "sam@demo.test", opts);
  await go(page, `/issues/${ISSUE}`);
  await page.locator("summary", { hasText: /^Leave$/ }).click();
  await page.getByRole("button", { name: "Leave this cause" }).click();
  await waitText(page, /1\s+of 150 signed/);
  assert.match(await text(page), /Join this cause/);
  await go(page, `/issues/${ISSUE}/events`);
  assert.match(await text(page), /No events coming up/);
  await go(page, `/issues/${ISSUE}/chat`);
  assert.match(await text(page), /The chat is for neighbours who.ve joined/);
  step("Leave: support, signature and chat access gone; event with nobody left cancelled");
  await page.context().close();
}

// 5. Priya deletes her account; wrong password is refused; signing back in restores it.
{
  const page = await signIn(browser, "priya@demo.test", opts);
  await go(page, "/me");
  await page.getByText("Delete my account…").click();
  await page.locator('input[name="password"]').fill("wrong-password");
  await page.getByRole("button", { name: "Delete my account" }).click();
  await page.getByText("That password isn't right.").waitFor({ timeout: 30000 });
  await page.locator('input[name="password"]').fill(PW);
  await Promise.all([page.waitForURL(/\/goodbye/, { timeout: 60000 }), page.getByRole("button", { name: "Delete my account" }).click()]);
  await settle(page);
  await go(page, "/me");
  assert.match(page.url(), /\/signin/);
  await go(page, "/area/ca/M5V");
  await page.getByText("Rent increases above guideline").first().click();
  await page.waitForURL(/\/issues\//);
  await settle(page);
  assert.match(await text(page), /started by Former member/i);
  step("Delete account: refused wrong password, signed out, shown as Former member");
  await page.context().close();

  const back = await signIn(browser, "priya@demo.test", opts);
  assert.match(back.url(), /\/me\?restored=1/);
  step("Signing back in restores the account");
  await back.context().close();
}

await browser.close();
console.log("All flows passed.");
