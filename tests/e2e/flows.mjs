// Click-through checks of the main journeys: events, chat, signatures, stepping
// down as host, leaving a cause, deleting an account.
// Needs fresh demo data (`npm run db:seed`), because it changes it.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BASE, CONTEXT, PW, findCause, go, launch, settle, signIn } from "./helpers.mjs";

const browser = await launch();
const opts = { viewport: { width: 1280, height: 860 }, colorScheme: "light", ...CONTEXT };
const text = (page) => page.locator("main").innerText();
const waitText = (page, re) => page.waitForFunction((src) => new RegExp(src, "i").test(document.querySelector("main").innerText), re.source, { timeout: 30000 });
const step = (s) => console.log("✓", s);

let CAUSE;
{
  const page = await (await browser.newContext(opts)).newPage();
  CAUSE = await findCause(page, "/area/us/90046?radius=25", "No safe crossing");
  // Causes used to live at /causes/…; shared links must still work.
  await go(page, `/issues/${CAUSE}/chat`);
  assert.equal(new URL(page.url()).pathname, `/causes/${CAUSE}/chat`);
  step("Old /issues/ links redirect to /causes/");

  // The privacy policy, terms and code of conduct are linked from every page's footer and from sign-up.
  for (const [label, heading] of [["Privacy", "Privacy policy"], ["Terms", "Terms of use"], ["Code of conduct", "Code of conduct"]]) {
    await page.locator("footer").getByRole("link", { name: label, exact: true }).click();
    await page.locator("h1", { hasText: heading }).waitFor({ timeout: 30000 });
  }
  await go(page, "/signup");
  const agree = page.locator("form").getByText(/By joining you agree/);
  for (const name of ["terms", "code of conduct", "privacy policy"]) assert.equal(await agree.getByRole("link", { name, exact: true }).count(), 1);
  step("Privacy, terms and conduct are linked from the footer and from sign-up");
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
    const expected = new Intl.DateTimeFormat(undefined, {
      weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit",
    }).formatRange(new Date(t.getAttribute("datetime")), new Date(t.dataset.end));
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
  await go(page, `/causes/${CAUSE}/chat`);
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
  await go(alex, `/causes/${CAUSE}/chat`);
  // E2E_EXPECT_LIVE=1 when the local chat server is running (cd realtime; npm run dev).
  const live = process.env.E2E_EXPECT_LIVE === "1";
  if (live) await alex.getByText("Live: new messages appear").waitFor({ timeout: 15000 });
  await alex.evaluate(() => (window.__notReloaded = true));

  const page = await signIn(browser, "sam@demo.test", opts);
  const consoleErrors = [];
  page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
  await go(page, `/causes/${CAUSE}/chat`);
  await page.waitForTimeout(1500); // let it hydrate
  assert.deepEqual(consoleErrors.filter((t) => /hydrat|cannot be a descendant/i.test(t)), [], "the chat page has hydration errors");
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

  // Sam fixes a typo in the message he just sent.
  const mine = page.locator("li", { hasText: "Counted 4 near-misses this morning" });
  await mine.getByRole("button", { name: "Edit" }).click();
  await page.getByLabel("Edit your message").fill("Counted 5 near-misses this morning.");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await waitText(page, /Counted 5 near-misses this morning/);
  assert.match(await page.locator("li", { hasText: "Counted 5 near-misses" }).innerText(), /edited/);
  assert.equal(await page.locator("li", { hasText: "I emailed the city" }).getByRole("button", { name: "Edit" }).count(), 0, "could edit someone else's message");
  step("You can fix your own message (shown as edited), not anyone else's");

  await go(page, `/causes/${CAUSE}`);
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
  await go(page, `/causes/${CAUSE}/events`);
  await page.getByText("Can't host it?").click();
  await page.getByRole("button", { name: "Step down as host" }).click();
  await waitText(page, /hosted by Sam\s*\(took over\)/);
  step("Step down: event now hosted by Sam (took over)");
  await page.context().close();
}

// 4. Sam leaves the cause → no longer joined, signature gone, the event with nobody left is cancelled.
{
  const page = await signIn(browser, "sam@demo.test", opts);
  await go(page, `/causes/${CAUSE}`);
  await page.locator("summary", { hasText: /^Leave$/ }).click();
  await page.getByRole("button", { name: "Leave this cause" }).click();
  await waitText(page, /1\s+of 150 signed/);
  assert.match(await text(page), /Join this cause/);
  await go(page, `/causes/${CAUSE}/events`);
  assert.match(await text(page), /No events coming up/);
  await go(page, `/causes/${CAUSE}/chat`);
  assert.match(await text(page), /The chat is for neighbours who.ve joined/);
  step("Leave: support, signature and chat access gone; event with nobody left cancelled");
  await page.context().close();
}

// 4b. Alex hands the crossing cause to Priya (a member since step 1); she accepts from the notice.
{
  const alex = await signIn(browser, "alex@demo.test", opts);
  await go(alex, `/causes/${CAUSE}`);
  assert.equal(await alex.locator("main summary:visible", { hasText: /^Leave$/ }).count(), 0, "the leader is offered Leave");
  const handOver = alex.locator("details", { hasText: "Hand over leading this cause" });
  await handOver.getByText("Hand over leading this cause").click();
  await handOver.getByLabel("Who should take over").selectOption({ label: "Priya" });
  await handOver.getByRole("button", { name: "Offer the lead" }).click();
  await handOver.getByText(/Waiting for Priya to accept/).waitFor({ timeout: 30000 });
  step("The leader offers the lead to a member");

  const priya = await signIn(browser, "priya@demo.test", opts);
  await go(priya, `/causes/${CAUSE}`);
  await priya.getByText(/Alex has asked you to lead this cause/).waitFor({ timeout: 30000 });
  await priya.getByRole("button", { name: "Accept" }).click();
  await priya.locator("main article header:visible").first().getByText(/led by Priya/i).waitFor({ timeout: 30000 });
  assert.match(await priya.locator("main article header:visible").first().innerText(), /started by Alex/i);
  assert.equal(await priya.getByText("Edit title and description").count(), 1, "the new leader should get the leader tools");
  await go(alex, `/causes/${CAUSE}`);
  assert.equal(await alex.getByText("Edit title and description").count(), 0, "the old leader still has the leader tools");
  step("The member accepts: the cause shows who started it and who leads it, and the tools move over");
  await alex.context().close();
  await priya.context().close();
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
  await page.waitForURL(/\/causes\//);
  await settle(page);
  assert.match(await text(page), /started by Former member/i);
  step("Delete account: refused wrong password, signed out, shown as Former member");
  await page.context().close();

  const back = await signIn(browser, "priya@demo.test", opts);
  assert.match(back.url(), /\/me\?restored=1/);
  step("Signing back in restores the account");

  // 5b. Priya now leads 3 active causes (two of her own plus the crossing): she can't start a 4th,
  //     and is shown why and the ways out. Closing one frees a slot.
  await go(back, "/causes/new");
  await back.getByText("You're leading 3 active causes").waitFor({ timeout: 30000 });
  assert.equal(await back.getByRole("button", { name: "Start this cause" }).count(), 0, "the form shows at the limit");
  assert.match(await text(back), /Mark it won[\s\S]*Close it[\s\S]*Hand it over/);
  await back.locator("main").getByRole("link", { name: /Trinity Bellwoods washrooms/ }).click();
  await back.waitForURL(/\/causes\/\w+/);
  await settle(back);
  const close = back.locator("details", { hasText: "Close this cause" });
  await close.getByText("Close this cause").click();
  await close.getByLabel("Why are you closing it?").fill("The city reopened them for good");
  await close.getByRole("button", { name: "Close the cause" }).click();
  await back.getByText(/You can still read everything here/).waitFor({ timeout: 30000 });
  await go(back, "/causes/new");
  await back.getByRole("button", { name: "Start this cause" }).waitFor({ timeout: 30000 });
  step("Leading 3 active causes: Start a cause explains the limit; closing one frees a slot");
  await back.context().close();
}

// 6. Starting a cause: a thin description is refused, with what to add; a proper one goes up.
{
  const page = await signIn(browser, "alex@demo.test", opts);
  await go(page, "/causes/new?country=CA&postal=M5V");
  await page.getByLabel("What's the cause?").fill("Broken bench outside the Spadina library");
  await page.locator('select[name="category"]').selectOption({ index: 1 });
  await page.getByLabel("City or town").check();
  const details = page.locator("textarea#description");
  await details.fill("The bench is broken and people can't sit down while they wait.");
  assert.match(await page.locator("#description-count").innerText(), /12 of 50 words/);
  await page.getByRole("button", { name: "Start this cause" }).click();
  await page.getByText(/Add a bit more so neighbours can decide to join/).waitFor({ timeout: 30000 });
  assert.notEqual(await page.locator('select[name="category"]').inputValue(), "", "the category was forgotten after the refusal");
  assert.equal(await page.getByLabel("City or town").isChecked(), true, "who should fix it was forgotten after the refusal");
  step("A thin description is refused, saying what to add, and the form keeps what was entered");
  await details.fill(
    "The bench outside the Spadina Road library has been broken since September. One leg snapped and it tips forward, " +
      "so nobody can sit on it. Older neighbours wait there for the 77 bus and now have to stand, sometimes for twenty minutes. " +
      "Parents with strollers use it too. Fixing it means the city replacing the bench, ideally with one that has arms to help people stand up.",
  );
  assert.match(await page.locator("#description-count").innerText(), /Good detail/);
  await Promise.all([
    page.waitForURL(/\/causes\/(?!new)\w+/, { timeout: 60000, waitUntil: "commit" }),
    page.getByRole("button", { name: "Start this cause" }).click(),
  ]);
  await settle(page);
  assert.match(await text(page), /Broken bench outside the Spadina library/);
  assert.match(await text(page), /Asking: the city/);
  step("A 60-word description starts the cause, asking the city");

  // Who can fix this: the area's councillor, provincial rep and MP, looked up by the area's centre.
  const who = page.locator("#who");
  await who.waitFor({ timeout: 30000 });
  const whoText = await who.innerText();
  for (const heading of ["CITY", "PROVINCE", "FEDERAL"]) assert.match(whoText.toUpperCase(), new RegExp(heading));
  assert.match(whoText, /Councillor/);
  assert.match(whoText, /\bMPP?\b/);
  assert.ok(whoText.toUpperCase().indexOf("CITY") < whoText.toUpperCase().indexOf("PROVINCE"), "the city should come first when the city should fix it");
  step("Who can fix this lists the councillor, provincial rep and MP, city first");

  // The leader adds someone to contact by hand.
  await who.getByText("Add someone to contact").click();
  await who.getByLabel("Name").fill("Spadina Road library branch manager");
  await who.getByLabel("Role (optional)").fill("Toronto Public Library");
  await who.getByRole("button", { name: "Save" }).click();
  await page.getByText("Added by whoever started this cause").waitFor({ timeout: 30000 });
  step("The leader can add someone to contact by hand");

  // A campaign starts addressed to the actual councillor; the leader can change who should fix it.
  await page.getByText("+ Start a campaign").click();
  assert.match(await page.locator('input[name="target"]').inputValue(), /^Councillor .+/);
  // (Next keeps the new-cause page hidden in the background for Back, so look only inside the change form.)
  const change = page.locator("details", { hasText: "Change who should fix it" });
  await change.getByText("Change who should fix it").click();
  await change.getByLabel("Province").check();
  await change.getByRole("button", { name: "Save" }).click();
  await waitText(page, /Asking: the province/);
  step("Campaigns start from who should fix it, and the leader can change it");

  // The person who started it fixes the title.
  const editCause = page.locator("details", { hasText: "Edit title and description" });
  await editCause.getByText("Edit title and description").click();
  await editCause.getByLabel("What's the cause?").fill("Broken bench outside the Spadina Road library");
  await editCause.getByRole("button", { name: "Save changes" }).click();
  await page.locator("h1", { hasText: "Spadina Road library" }).waitFor({ timeout: 30000 });
  assert.match(await page.locator("main article header:visible").first().innerText(), /edited/i);
  step("The person who started a cause can edit it (shown as edited)");

  // 7. An event with an end time: the end follows the start until changed; the page and calendar file use it.
  const causePath = new URL(page.url()).pathname;
  await go(page, `${causePath}/events`);
  await page.getByText("+ Organize an event").click();
  const form = page.locator("form", { has: page.getByRole("button", { name: "Create meetup" }) });
  await form.getByLabel("Title").fill("Bench measuring walk");
  const day = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
  const ymd = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
  await form.getByLabel("Starts").fill(`${ymd}T18:00`);
  assert.equal(await form.getByLabel("Ends").inputValue(), `${ymd}T20:00`, "the end didn't follow the start");
  await form.getByLabel("Ends").fill(`${ymd}T19:30`);
  await form.getByLabel("Where").fill("Outside the Spadina Road library");
  await Promise.all([page.waitForURL(/\/events\/\w+/, { timeout: 60000, waitUntil: "commit" }), form.getByRole("button", { name: "Create meetup" }).click()]);
  await settle(page);
  const range = await page.locator("main dl time").innerText();
  assert.match(range, /6:00/);
  assert.match(range, /7:30/);
  const file = await (await page.request.get(`${page.url()}/calendar.ics`)).text();
  const dtend = file.match(/DTEND:(\d{8}T\d{6}Z)/)[1];
  // The picker is in the browser's time zone (Toronto here), so work the expected end out there.
  const expectedEnd = await page.evaluate((local) => new Date(local).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""), `${ymd}T19:30`);
  assert.equal(dtend, expectedEnd);
  step(`An event shows its time range (${range}) and the calendar file ends when it does`);

  // The host changes the event's details.
  const editEvent = page.locator("details", { hasText: "Edit event details" });
  await editEvent.getByText("Edit event details").click();
  await editEvent.getByLabel("Title").fill("Bench measuring walk (bring a tape measure)");
  await editEvent.getByRole("button", { name: "Save changes" }).click();
  await page.locator("h1", { hasText: "bring a tape measure" }).waitFor({ timeout: 30000 });
  assert.match(await page.locator("main article header:visible").first().innerText(), /edited/i);
  step("The host can edit an event (shown as edited)");

  // 8. Stages are milestones, not gates: a one-person cause skips straight to Taking action
  //    by logging a contact, then a member confirms the win.
  const currentStage = (p) => p.locator('main [aria-current="step"]:visible').first().innerText();
  await go(page, causePath);
  assert.equal(await currentStage(page), "Raised");
  const contact = page.locator("details", { hasText: "we contacted someone" });
  await contact.getByText("Add to the timeline: we contacted someone").click();
  await contact.getByLabel("Who?").fill("Councillor for Spadina");
  await contact.getByLabel("How?").selectOption("letter");
  await contact.getByLabel("Anything to add? (optional)").fill("Dropped off a letter at city hall.");
  await contact.getByRole("button", { name: "Add to timeline" }).click();
  await page.locator("#timeline").getByText("Contacted Councillor for Spadina by letter").waitFor({ timeout: 30000 });
  assert.equal(await currentStage(page), "Taking action");
  step("Logging a contact skips a new cause straight to Taking action, on the timeline");

  const propose = page.locator("details", { hasText: "propose a win" });
  await propose.getByText("It's fixed: propose a win").click();
  await propose.getByLabel("What happened?").fill("The city replaced the bench this morning.");
  await propose.getByRole("button", { name: "Ask members to confirm" }).click();
  await page.getByText(/You proposed a win: 0 of 1 confirmations/).waitFor({ timeout: 30000 });
  assert.equal(await page.getByRole("button", { name: "Yes, it's fixed" }).count(), 0, "the leader can confirm their own win");

  const sam = await signIn(browser, "sam@demo.test", opts);
  await go(sam, causePath);
  await sam.locator("main").getByRole("button", { name: "Join this cause" }).first().click();
  await sam.getByRole("button", { name: "Yes, it's fixed" }).waitFor({ timeout: 30000 });
  assert.match(await sam.locator("#win").innerText(), /Alex says it.s fixed/);
  await sam.getByRole("button", { name: "Yes, it's fixed" }).click();
  await sam.locator('main [aria-current="step"]:visible', { hasText: "Won" }).waitFor({ timeout: 30000 });
  assert.match(await sam.locator("#timeline").innerText(), /Won, confirmed by members/);
  step("A member confirms the leader's win (1 needed for a small cause) and it's Won");
  await sam.context().close();
  await page.context().close();
}

// 9. Sam closes the trail cause he leads: the chat goes read-only and the notice offers Reopen.
{
  const page = await signIn(browser, "sam@demo.test", opts);
  const trail = await findCause(page, "/area/us/90046?radius=25", "Runyon Canyon trailhead");
  await go(page, `/causes/${trail}`);
  const close = page.locator("details", { hasText: "Close this cause" });
  await close.getByText("Close this cause").click();
  await close.getByLabel("Why are you closing it?").fill("The parks department took it over.");
  await close.getByRole("button", { name: "Close the cause" }).click();
  await page.getByText(/The parks department took it over\. You can still read everything here/).waitFor({ timeout: 30000 });
  assert.equal(await page.locator("main").getByRole("button", { name: "Join this cause" }).count(), 0);
  await go(page, `/causes/${trail}/chat`);
  assert.match(await text(page), /This cause is closed, so the chat is read-only/);
  step("Closing a cause shows why, and the chat becomes read-only");

  await page.getByRole("button", { name: "Reopen" }).click();
  await page.getByLabel("Your message").waitFor({ timeout: 30000 });
  assert.doesNotMatch(await text(page), /This cause is closed/);
  step("The leader can reopen it");

  // 10. Co-leaders: Alex joins the trail cause, Sam invites him to co-lead, Alex accepts and gets the leader tools.
  const alex = await signIn(browser, "alex@demo.test", opts);
  await go(alex, `/causes/${trail}`);
  await alex.locator("main").getByRole("button", { name: "Join this cause" }).first().click();
  await alex.getByText("✓ Joined").first().waitFor({ timeout: 30000 });

  await go(page, `/causes/${trail}`);
  const co = page.locator("details", { hasText: "Up to 2 members can share leading" });
  await co.locator("summary").click();
  await co.getByLabel("Who to invite to co-lead").selectOption({ label: "Alex" });
  await co.getByRole("button", { name: "Invite to co-lead" }).click();
  await co.getByText(/invited, waiting for an answer/).waitFor({ timeout: 30000 });
  step("The leader invites a member to co-lead");

  await go(alex, `/causes/${trail}`);
  await alex.getByText(/has asked you to co-lead this cause/).waitFor({ timeout: 30000 });
  await alex.getByRole("button", { name: "Accept" }).click();
  await alex.locator("main article header:visible").first().getByText(/led by Sam and Alex/i).waitFor({ timeout: 30000 });
  assert.equal(await alex.getByText("Edit title and description").count(), 1, "the co-leader should get the leader tools");
  assert.equal(await alex.getByText("Hand over leading this cause").count(), 0, "a co-leader can't hand the cause over");
  step("The member accepts: shown as led by both, with the leader tools (but not handing over)");

  await go(alex, `/causes/${trail}/events`);
  await alex.getByText("+ Organize an event").click();
  const form = alex.locator("form", { has: alex.getByRole("button", { name: "Create meetup" }) });
  await form.getByLabel("Title").fill("Trailhead clean-up");
  const day = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
  const ymd = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
  await form.getByLabel("Starts").fill(`${ymd}T09:00`);
  await form.getByLabel("Where").fill("Runyon Canyon trailhead gate");
  await Promise.all([alex.waitForURL(/\/events\/\w+/, { timeout: 60000, waitUntil: "commit" }), form.getByRole("button", { name: "Create meetup" }).click()]);
  await settle(alex);
  assert.match(await text(alex), /Trailhead clean-up/);
  step("The co-leader organizes an event");

  // 11. Email notifications (#18). Events starting about a day from now get reminders from the daily job.
  // Sam hosts: demo accounts are new for a day (2 events an hour), and Alex has made his two.
  const host = page;
  const runDaily = async () => {
    const env = readFileSync(new URL("../../.env", import.meta.url), "utf8");
    const cronSecret = env.match(/^CRON_SECRET="?([^"\r\n]*)"?/m)?.[1];
    const res = await host.request.get(`${BASE}/api/cron/daily`, { headers: { Authorization: `Bearer ${cronSecret}` } });
    assert.equal(res.status(), 200);
    return (await res.json()).emails.reminded;
  };
  const eventTomorrow = async (title) => {
    await go(host, `/causes/${trail}/events`);
    await host.getByText("+ Organize an event").click();
    const f = host.locator("form", { has: host.getByRole("button", { name: "Create meetup" }) });
    await f.getByLabel("Title").fill(title);
    const start = await host.evaluate(() => {
      const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const pad = (n) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    });
    await f.getByLabel("Starts").fill(start);
    await f.getByLabel("Where").fill("Runyon Canyon trailhead gate");
    await f.getByRole("button", { name: "Create meetup" }).click();
    await host.waitForURL(/\/events\/\w+/, { timeout: 60000, waitUntil: "commit" }).catch(async (e) => {
      throw new Error(`Creating "${title}" didn't go through. The form says: ${await f.innerText().catch(() => "?")}`, { cause: e });
    });
    await settle(host);
  };

  await eventTomorrow("Litter pick tomorrow");
  const reminded = await runDaily();
  assert.ok(reminded.some((r) => r.email === "sam@demo.test" && r.event === "Litter pick tomorrow"), "the host who's going wasn't reminded");
  assert.ok(!reminded.some((r) => r.email === "alex@demo.test" && r.event === "Litter pick tomorrow"), "someone not going was reminded");
  assert.equal((await runDaily()).filter((r) => r.event === "Litter pick tomorrow").length, 0, "a reminder went out twice");
  step("The day before an event, people going get a reminder (once), others don't");

  await go(host, "/me#email");
  const prefs = host.locator("#email");
  assert.equal(await prefs.getByLabel(/Chat summary/).isChecked(), false, "the chat summary should be off by default");
  await prefs.getByLabel(/Event reminders/).uncheck();
  await prefs.getByRole("button", { name: "Save email settings" }).click();
  await prefs.getByText("Saved.").waitFor({ timeout: 30000 });
  await go(host, "/me");
  assert.equal(await host.locator("#email").getByLabel(/Event reminders/).isChecked(), false, "the setting wasn't saved");
  await eventTomorrow("Second litter pick");
  assert.ok(!(await runDaily()).some((r) => r.email === "sam@demo.test"), "reminded after turning reminders off");
  step("Turning off event reminders on /me stops them");

  await go(host, "/unsubscribe?u=someone&k=won&t=not-a-real-token");
  await host.getByRole("button", { name: "Unsubscribe" }).click();
  await host.getByText(/That link didn.t work/).waitFor({ timeout: 30000 });
  step("A forged unsubscribe link changes nothing");
  await alex.context().close();
  await page.context().close();
}

await browser.close();
console.log("All flows passed.");
