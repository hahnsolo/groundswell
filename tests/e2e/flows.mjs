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

  // Shared links show the cause in previews (WhatsApp, iMessage, Facebook), with a picture.
  const preview = await page.request.get(`${BASE}/causes/${CAUSE}`, { headers: { "User-Agent": "facebookexternalhit/1.1" } });
  const head = await preview.text();
  assert.match(head, /<title>No safe crossing on Santa Monica Blvd[^<]*· Groundswell<\/title>/);
  assert.match(head, /<meta property="og:description" content="Beverly Hills, CA · \d+ neighbours? ha(s|ve) joined/);
  const ogImage = head.match(/<meta property="og:image" content="([^"]+)"/)?.[1];
  assert.ok(ogImage, "no preview image");
  const img = await page.request.get(new URL(new URL(ogImage).pathname + new URL(ogImage).search, BASE).toString());
  assert.equal(img.status(), 200);
  assert.equal(img.headers()["content-type"], "image/png");
  step("A shared cause link previews with its title, place, members and a picture");

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
  assert.match(await text(page), /(Alex and Sam|Sam and Alex) are going/);
  assert.match(await text(page), /✓ You're going/);
  await page.getByRole("button", { name: "✓ You're going" }).click();
  await waitText(page, /Alex is going/);
  await page.getByRole("button", { name: "I'll be there" }).click();
  await waitText(page, /(Alex and Sam|Sam and Alex) are going/);
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
  await mine.getByLabel("Message options").click(); // the small ⋯ menu on each message (#70)
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
  const runDailyEmails = async () => { // the daily job's report of who it told
    const env = readFileSync(new URL("../../.env", import.meta.url), "utf8");
    const cronSecret = env.match(/^CRON_SECRET="?([^"\r\n]*)"?/m)?.[1];
    const res = await host.request.get(`${BASE}/api/cron/daily`, { headers: { Authorization: `Bearer ${cronSecret}` } });
    assert.equal(res.status(), 200);
    return (await res.json()).notifications;
  };
  const runDaily = async () => (await runDailyEmails()).reminded;
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
  // Push (#72): subscriptions with a stand-in push service. One device works; the other is gone for good.
  const pushApi = `${BASE}/api/push`;
  const fakeDevice = (name) => ({ endpoint: `https://fake-push.test/${name}`, keys: { p256dh: "test-key", auth: "test-auth" } });
  // The dev server sometimes drops an idle connection: try again rather than fail the run.
  const getPush = async (p) => {
    for (let attempt = 1; ; attempt++) {
      try {
        return await p.request.get(pushApi);
      } catch (e) {
        if (e.code !== "ECONNRESET" || attempt === 3) throw e;
      }
    }
  };
  const myDevices = async (p) => (await (await getPush(p)).json()).endpoints;
  assert.equal((await host.request.post(pushApi, { data: { endpoint: "https://evil.example/x", keys: { p256dh: "a", auth: "b" } } })).status(), 400, "only real push services");
  assert.equal((await host.request.post(pushApi, { data: fakeDevice("sam-phone") })).status(), 200);
  assert.equal((await host.request.post(pushApi, { data: fakeDevice("gone") })).status(), 200);
  const reminded = await runDaily();
  assert.equal(reminded.find((r) => r.email === "sam@demo.test" && r.event === "Litter pick tomorrow")?.channel, "push", "someone with push on gets it there too");
  assert.deepEqual(await myDevices(host), [fakeDevice("sam-phone").endpoint], "a device that's gone for good is forgotten");
  // Signing out stops it on that device, and only that one.
  const samLaptop = await signIn(browser, "sam@demo.test", opts);
  assert.equal((await samLaptop.request.post(pushApi, { data: fakeDevice("sam-laptop") })).status(), 200);
  assert.equal((await myDevices(samLaptop)).length, 2);
  await go(samLaptop, "/me");
  await samLaptop.getByRole("button", { name: "Sign out" }).click();
  await samLaptop.waitForFunction(() => !location.pathname.startsWith("/me"), null, { timeout: 30000 });
  assert.equal((await getPush(samLaptop)).status(), 401);
  assert.deepEqual(await myDevices(host), [fakeDevice("sam-phone").endpoint], "signing out stops push on that device, not the others");
  await samLaptop.context().close();
  step("Push: stored for this device, dead devices forgotten, signing out stops it");
  assert.ok(reminded.some((r) => r.email === "sam@demo.test" && r.event === "Litter pick tomorrow"), "the host who's going wasn't reminded");
  assert.ok(!reminded.some((r) => r.email === "alex@demo.test" && r.event === "Litter pick tomorrow"), "someone not going was reminded");
  assert.equal((await runDaily()).filter((r) => r.event === "Litter pick tomorrow").length, 0, "a reminder went out twice");
  step("The day before an event, people going get a reminder (once), others don't");

  await go(host, "/me#email");
  const prefs = host.locator("#email");
  assert.equal(await prefs.getByLabel(/Chat summary/).isChecked(), false, "the chat summary should be off by default");
  await prefs.getByLabel(/Event reminders/).uncheck();
  await prefs.getByRole("button", { name: "Save notification settings" }).click();
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

  // 12. Cover images (#66). A test photo, drawn in the browser (wide, so it can slide left and right).
  const photo = async (p, colour) =>
    Buffer.from(
      (
        await p.evaluate((c) => {
          const canvas = Object.assign(document.createElement("canvas"), { width: 2400, height: 1000 });
          const ctx = canvas.getContext("2d");
          ctx.fillStyle = c;
          ctx.fillRect(0, 0, 2400, 1000);
          ctx.fillStyle = "#fff";
          ctx.fillRect(1100, 400, 200, 200);
          return canvas.toDataURL("image/png");
        }, colour)
      ).split(",")[1],
      "base64",
    );
  const coverImg = (p) => p.locator("main article figure:visible img").first();

  await go(page, `/causes/${trail}`);
  const coverTool = page.locator("details", { hasText: "Add a cover image" });
  await coverTool.locator("summary").click();
  await coverTool.getByLabel("Choose a cover image for this cause").setInputFiles({ name: "trail.png", mimeType: "image/png", buffer: await photo(page, "#2d6a4f") });
  await coverTool.getByLabel("Preview of the cover image").waitFor({ timeout: 30000 });
  assert.equal(await coverTool.getByText("Slide left or right").count(), 1, "a wide photo should slide left and right");
  await coverTool.getByLabel(/Describe the image/).fill("The trailhead gate with litter along the fence");
  await coverTool.getByRole("button", { name: "Use this image" }).click();
  await coverImg(page).waitFor({ timeout: 60000 });
  assert.equal(await coverImg(page).getAttribute("alt"), "The trailhead gate with litter along the fence");
  assert.ok(await coverImg(page).evaluate((i) => i.complete && i.naturalWidth === 1600), "the cover should be stored at 1600px wide");
  const first = await coverImg(page).getAttribute("src");
  // JPEG, because link previews (and our preview cards) can't show WebP.
  const stored = await page.request.get(first.startsWith("http") ? first : `${BASE}${first}`);
  assert.equal((await stored.body()).subarray(0, 2).toString("hex"), "ffd8", "the full-size cover should be a JPEG");
  step("A leader adds a cover image: positioned, described, resized to 1600px");

  const og = await page.request.get(`${BASE}/causes/${trail}/opengraph-image`);
  assert.equal(og.status(), 200);
  await go(page, "/area/us/90046?radius=25");
  const card = page.locator("a", { hasText: "Runyon Canyon trailhead" }).first();
  assert.ok(await card.locator("img").evaluate((i) => i.naturalWidth === 480), "the card should use the 480px thumbnail");
  step("The cover shows on the cause, on its card (small version) and in its link preview");

  // Someone who doesn't lead it can't set it, even by calling the upload directly.
  const outsider = await signIn(browser, "priya@demo.test", opts);
  const sneaky = await outsider.request.post(`${BASE}/api/media/cover`, {
    multipart: { target: "cause", id: trail, alt: "", full: { name: "a.webp", mimeType: "image/webp", buffer: Buffer.from("RIFF0000WEBPVP8 ") }, thumb: { name: "b.webp", mimeType: "image/webp", buffer: Buffer.from("RIFF0000WEBPVP8 ") } },
  });
  assert.equal(sneaky.status(), 403);
  await go(outsider, `/causes/${trail}`);
  assert.equal(await outsider.getByText("Add a cover image").count() + (await outsider.getByText("Change the cover image").count()), 0);
  await outsider.context().close();
  step("Someone who doesn't lead the cause can't change its image");

  await go(page, `/causes/${trail}`);
  const change = page.locator("details", { hasText: "Change the cover image" });
  await change.locator("summary").click();
  await change.getByLabel("Choose a cover image for this cause").setInputFiles({ name: "trail2.png", mimeType: "image/png", buffer: await photo(page, "#9d0208") });
  await change.getByRole("button", { name: "Use this image" }).click();
  await page.waitForFunction((old) => {
    const img = [...document.querySelectorAll("main article figure img")].find((i) => i.offsetParent);
    return img && img.getAttribute("src") !== old;
  }, first, { timeout: 60000 });
  const gone = await page.request.get(first.startsWith("http") ? first : `${BASE}${first}`);
  assert.equal(gone.status(), 404, "the replaced image should be deleted from storage");
  await page.locator("details", { hasText: "Change the cover image" }).getByRole("button", { name: "Remove image" }).click();
  await page.waitForFunction(() => ![...document.querySelectorAll("main article figure img")].some((i) => i.offsetParent), null, { timeout: 30000 });
  step("Replacing a cover deletes the old file; removing it takes it down");

  // 13. Flyers and share images (#67). Sam prints a flyer for an event; Priya's cause gets a member from its flyer.
  await go(page, `/causes/${trail}/events`);
  const eventHref = await page.locator('main a[href^="/events/"]').first().getAttribute("href");
  await go(page, eventHref);
  const spread = page.locator("details#spread");
  await spread.locator("summary").click();
  await spread.getByRole("link", { name: /Print a flyer/ }).click();
  const sheet = page.getByRole("article", { name: "Flyer" });
  await sheet.waitFor({ timeout: 60000 });
  const flyerText = await sheet.innerText();
  assert.match(flyerText, /Hosted by \S+ ·/, "the flyer should name the host by first name");
  assert.match(flyerText, /Runyon Canyon trailhead gate/, "the flyer should say where");
  assert.equal(await sheet.locator("[data-qr] svg").count(), 1, "the flyer should have a QR code");
  assert.match(flyerText, /\/go\/[a-z2-9]{6}/, "the flyer should have a short link to type");
  await page.getByLabel("Tear-off strips along the bottom").check();
  assert.equal(await sheet.locator("[data-qr] svg").count(), 8, "tear-off strips each carry the QR code");
  step("An event flyer has the title, place, host's first name, a QR code and tear-off strips");

  for (const [format, w, h] of [["card", 1200, 630], ["square", 1080, 1080], ["story", 1080, 1920]]) {
    const img = await page.request.get(`${BASE}${eventHref.replace("/events/", "/share/event/")}/${format}?src=instagram`);
    assert.equal(img.status(), 200, `${format} image`);
    const png = await img.body();
    assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [w, h], `${format} should be ${w}×${h}`);
  }
  step("Share images come in three sizes: card, square post and story");

  const priyaLeads = await signIn(browser, "priya@demo.test", opts);
  const park = await findCause(priyaLeads, "/area/ca/M5V", "Rent increases above guideline");
  await go(priyaLeads, `/flyer/cause/${park}`);
  const code = (await priyaLeads.getByRole("article", { name: "Flyer" }).innerText()).match(/\/go\/([a-z2-9]{6})/)[1];
  // Sam scans the flyer's QR code and joins.
  await go(page, `/go/${code}`);
  assert.match(page.url(), new RegExp(`/causes/${park}`), "the short link should open the cause");
  await page.waitForFunction(() => !location.search.includes("src="), null, { timeout: 30000 });
  await page.locator("main").getByRole("button", { name: "Join this cause" }).first().click();
  await page.getByText("✓ Joined").first().waitFor({ timeout: 30000 });
  await go(priyaLeads, `/causes/${park}`);
  assert.match(await text(priyaLeads), /Where people came from: 1 person came from the flyer/);
  await go(page, `/causes/${park}`);
  assert.doesNotMatch(await text(page), /Where people came from/, "only the people leading it see where people came from");
  step("Someone who comes from the flyer's QR code and joins counts once as from the flyer, for the leaders to see");

  // 14. Bring your group over (#68). Priya's own invite link, ready-written messages, and her contact list read on her device only.
  assert.equal(await page.locator("details#invite").count(), 0, "members don't get an invite panel");
  await go(priyaLeads, `/causes/${park}`);
  const invite = priyaLeads.locator("details#invite");
  await invite.evaluate((d) => (d.open = true)); // open already while it's gathering people (#76)
  const inviteLink = (await invite.locator("code").first().innerText()).trim();
  assert.match(inviteLink, /\/i\/[a-z2-9]{6}$/, "Priya gets a personal invite link");
  assert.match(await invite.innerText(), /Nobody has joined from your invite yet/);
  const wa = await invite.getByRole("link", { name: "Share to WhatsApp" }).getAttribute("href");
  assert.ok(wa.startsWith("https://wa.me/?text=") && decodeURIComponent(wa).includes(inviteLink), "WhatsApp opens with the message and the link");
  assert.match(await invite.getByRole("link", { name: "Email", exact: true }).getAttribute("href"), /^mailto:\?subject=/);
  // Her contact list: nothing about it may leave the browser.
  const sent = [];
  priyaLeads.on("request", (r) => sent.push(`${r.url()} ${r.postData() ?? ""}`));
  const csv = "First name,Last name,Email,Mobile\nMaya,Chen,maya.list@example.com,(416) 555-0101\nDev,Shah,,416-555-0102\nRosa,,rosa.list@example.com,\nNo,Contact,,\n";
  await invite.getByLabel("Choose a contact list spreadsheet").setInputFiles({ name: "my-group.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await invite.getByRole("status").filter({ hasText: "my-group.csv" }).waitFor({ timeout: 30000 });
  assert.match(await invite.innerText(), /3 people \(2 with email, 2 with a phone number\); 1 rows had neither/);
  const bcc = await invite.getByRole("link", { name: "Open in my email" }).getAttribute("href");
  assert.match(decodeURIComponent(bcc), /^mailto:\?bcc=maya\.list@example\.com,rosa\.list@example\.com&subject=/);
  const devWa = await invite.locator("li", { hasText: "Dev Shah" }).getByRole("link", { name: "WhatsApp" }).getAttribute("href");
  assert.match(devWa, /^https:\/\/wa\.me\/14165550102\?text=Hi%20Dev!/, "each phone number gets its own message, with their name");
  await invite.locator("li", { hasText: "Dev Shah" }).getByRole("checkbox").check();
  assert.match(await invite.innerText(), /Phone \(1 of 2 sent\)/);
  await priyaLeads.waitForTimeout(1000);
  assert.ok(!sent.some((s) => /maya\.list|rosa\.list|555-0101|5550101|my-group/.test(s)), `the contact list must never leave the browser: ${sent.filter((s) => /list|555/.test(s)).join(" | ")}`);
  step("A leader's invite panel: own link, ready-written messages, and a contact list that never leaves the browser");

  // Alex follows Priya's invite link and joins: it counts for her.
  await go(alex, new URL(inviteLink).pathname);
  assert.match(alex.url(), new RegExp(`/causes/${park}`), "the invite link opens the cause");
  await alex.waitForFunction(() => !location.search.includes("src="), null, { timeout: 30000 });
  await alex.locator("main").getByRole("button", { name: "Join this cause" }).first().click();
  await alex.getByText("✓ Joined").first().waitFor({ timeout: 30000 });
  await go(priyaLeads, `/causes/${park}`);
  assert.match(await text(priyaLeads), /Where people came from: 1 person came from the flyer, 1 from invites/);
  await priyaLeads.locator("details#invite").evaluate((d) => (d.open = true));
  assert.match(await priyaLeads.getByTestId("invite-count").innerText(), /1 person has joined from your invite/);
  step("Someone who joins through a leader's invite link counts toward 'joined from your invite'");

  // 15. The leader panel (#76): near the top of About, next step first, tools grouped; members see none of it.
  await go(priyaLeads, `/causes/${park}`);
  const panel = priyaLeads.locator("section#leader");
  const [panelTop, descTop] = await Promise.all([panel.boundingBox(), priyaLeads.locator("main p", { hasText: "Several tenants" }).first().boundingBox()]);
  assert.ok(panelTop.y < descTop.y, "the leader panel comes before the description");
  assert.match(await priyaLeads.getByTestId("leader-next").innerText(), /Next: get 2 more neighbours to join\.\s*Invite your group/);
  assert.ok(await panel.locator("details#invite").evaluate((d) => d.open), "while it's gathering people, the invite tools are open");
  for (const group of ["Move it forward", "People", "The cause"]) assert.equal(await panel.getByRole("heading", { name: group }).count(), 1, `group: ${group}`);
  for (const tool of ["It's fixed: propose a win", "Add to the timeline: we contacted someone", "Close this cause", "Co-leaders", "Hand over leading this cause", "Edit title and description", "Change who should fix it", "Add a cover image"]) {
    assert.equal(await panel.getByText(tool, { exact: true }).count(), 1, `the panel has: ${tool}`);
  }
  assert.match(await priyaLeads.locator("[aria-label^='Stage:']").innerText(), /Get 2 more neighbours to join and this moves to Gathering/);
  await go(page, `/causes/${park}`);
  assert.equal(await page.locator("section#leader").count(), 0, "members don't see the leader panel");
  assert.match(await page.locator("[aria-label^='Stage:']").innerText(), /2 more neighbours joining moves this to Gathering/);
  step("The leader panel sits near the top with the next step first and every tool grouped; members see none of it");

  // 16. A leader's home on /me (#75): Priya proposes a win and invites Alex to co-lead; both see what needs them.
  const coLead = panel.locator("details", { hasText: "Co-leaders" });
  await coLead.locator("summary").click();
  await coLead.getByLabel("Who to invite to co-lead").selectOption({ label: await coLead.locator("option", { hasText: "Alex" }).first().innerText() });
  await coLead.getByRole("button", { name: "Invite to co-lead" }).click();
  await coLead.getByText("invited, waiting for an answer").waitFor({ timeout: 30000 });
  const winTool = panel.locator("details", { hasText: "propose a win" });
  await winTool.getByText("It's fixed: propose a win").click();
  await winTool.getByLabel("What happened?").fill("The landlord withdrew the above-guideline application.");
  await winTool.getByRole("button", { name: "Ask members to confirm" }).click();
  await priyaLeads.getByText(/You proposed a win: 0 of 1/).waitFor({ timeout: 30000 });

  await go(priyaLeads, "/me");
  const needs = priyaLeads.locator("section", { has: priyaLeads.getByRole("heading", { name: "Needs you" }) });
  assert.match(await needs.innerText(), /Your win on "Rent increases above guideline[^"]*" is waiting: 0 of 1 confirmations/);
  const lead = priyaLeads.locator("section", { has: priyaLeads.getByRole("heading", { name: "Causes you lead" }) });
  assert.match(await lead.innerText(), /Rent increases above guideline[\s\S]*Raised · 3 members/);
  const started = priyaLeads.locator("section", { has: priyaLeads.getByRole("heading", { name: "Causes you started" }) });
  assert.doesNotMatch(await started.innerText(), /Rent increases/, "causes you lead aren't listed again under started");

  await go(alex, "/me");
  const alexNeeds = alex.locator("section", { has: alex.getByRole("heading", { name: "Needs you" }) });
  const alexText = await alexNeeds.innerText();
  assert.match(alexText, /asked you to co-lead "Rent increases/);
  assert.match(alexText, /says "Rent increases[^"]*" is fixed\. Is it\?/);
  await alexNeeds.getByRole("link", { name: /is fixed\. Is it\?/ }).click();
  await alex.waitForURL(new RegExp(`/causes/${park}#win$`));
  await alex.getByRole("button", { name: "Yes, it's fixed" }).waitFor({ timeout: 30000 });
  await go(alex, "/me");
  await alex.locator("section", { has: alex.getByRole("heading", { name: "Needs you" }) }).getByRole("link", { name: /asked you to co-lead/ }).click();
  await alex.waitForURL(new RegExp(`/causes/${park}$`));
  await alex.getByRole("button", { name: "Accept" }).waitFor({ timeout: 30000 });
  step("/me shows the causes you lead and what needs you (a win waiting, a co-lead invite), each linking to the right place");

  // 17. Deliver the petition (#74). Priya starts a campaign, Sam and Alex sign, she downloads it and logs the delivery.
  await go(priyaLeads, `/causes/${park}`);
  await priyaLeads.getByText("+ Start a campaign").click();
  await priyaLeads.getByLabel("Who can fix this?").fill("Spadina Property Management");
  await priyaLeads.getByLabel("What exactly are you asking for?").fill("Withdraw the above-guideline rent increase application for 3 buildings on Spadina.");
  await priyaLeads.getByRole("button", { name: "Start campaign" }).click();
  await priyaLeads.getByTestId("deliver").waitFor({ timeout: 30000 });
  for (const who of [page, alex]) {
    await go(who, `/causes/${park}`);
    assert.match(await who.locator("#ask").innerText(), /Your name and rough area .* go on the petition/, "signers are told what goes on the petition");
    await who.locator("#ask").getByLabel("Why this matters to you").fill(who === page ? '=1+1 "my rent" went up' : "");
    await who.locator("#ask").getByRole("button", { name: "Add my name" }).click();
    await who.getByText("✓ You've signed this campaign").waitFor({ timeout: 30000 });
  }
  assert.equal(await page.getByTestId("deliver").count(), 0, "members don't see the download");
  const pdfHref = await priyaLeads.getByRole("link", { name: "Download PDF" }).getAttribute("href");
  const csvHref = await priyaLeads.getByRole("link", { name: "Download spreadsheet (CSV)" }).getAttribute("href");
  assert.equal((await page.request.get(`${BASE}${csvHref}`)).status(), 404, "a member can't download the petition");
  const csvRes = await priyaLeads.request.get(`${BASE}${csvHref}`);
  assert.match(csvRes.headers()["content-disposition"], /attachment; filename="petition-withdraw-the-above-guideline.*\.csv"/);
  const csvText = await csvRes.text();
  const csvLines = csvText.trim().split(/\r\n/);
  assert.equal(csvLines[0].replace(/^﻿/, ""), "Name,Area,Signed on,Note");
  assert.deepEqual([...(await csvRes.body()).subarray(0, 3)], [0xef, 0xbb, 0xbf], "starts with a BOM so Excel reads accents right");
  assert.equal(csvLines.length, 4, "a header and the three signatures (Priya signed when she started it)");
  assert.match(csvText, /Sam[^,]*,"90046, USA",\d{4}-\d\d-\d\d,"'=1\+1 ""my rent"" went up"/, "Sam's row, with the note made safe for spreadsheets");
  assert.doesNotMatch(csvText, /@/, "no emails");
  const pdf = await priyaLeads.request.get(`${BASE}${pdfHref}`);
  assert.equal(pdf.headers()["content-type"], "application/pdf");
  const pdfBytes = await pdf.body();
  assert.equal(pdfBytes.subarray(0, 5).toString(), "%PDF-");
  assert.ok(pdfBytes.length > 1500, "the PDF has content");
  step("Signers are told; a leader downloads the petition as a PDF and a spreadsheet (3 signatures, no emails); members can't");

  const deliver = priyaLeads.getByTestId("deliver");
  await deliver.getByText("📬 We delivered it").click();
  await deliver.getByLabel("How?").selectOption("in_person");
  await deliver.getByLabel("Anything to add? (optional)").fill("Handed to the property manager at the front office.");
  await deliver.getByRole("button", { name: "Add to timeline" }).click();
  await priyaLeads.locator("#timeline").getByText("Petition delivered to Spadina Property Management in person, with 3 signatures").waitFor({ timeout: 30000 });
  assert.match(await priyaLeads.locator("[aria-label^='Stage:']").getAttribute("aria-label"), /Taking action/);
  await priyaLeads.context().close();
  step("'We delivered it' logs the delivery on the timeline and the cause is Taking action");

  // 18. The chat on a phone (#70): fills the screen, the box is in view, it stays at the newest message,
  //     and someone scrolled up gets "New messages ↓" instead of being yanked down.
  const phone = await signIn(browser, "sam@demo.test", { ...opts, viewport: { width: 390, height: 560 }, isMobile: true, hasTouch: true });
  await go(phone, `/causes/${trail}/chat`);
  const phoneBox = phone.getByLabel("Your message");
  const inView = () =>
    phone.evaluate(() => {
      const s = document.querySelector("[data-chat-scroll]");
      const box = document.querySelector("textarea[aria-label='Your message']").getBoundingClientRect();
      return { boxVisible: box.top >= 0 && box.bottom <= window.innerHeight, fromBottom: Math.round(s.scrollHeight - s.scrollTop - s.clientHeight), scrollable: s.scrollHeight > s.clientHeight };
    });
  assert.ok(await phone.getByRole("link", { name: "Back to the cause" }).isVisible(), "a one-line header with a way back");
  // Enough messages that the chat scrolls.
  for (let n = 1; n <= 12 && (n <= 3 || !(await inView()).scrollable); n++) {
    await phoneBox.fill(`Phone check ${n}: on my way to the trailhead with bags, gloves and the grabbers from the hardware store.`);
    await phone.getByRole("button", { name: "Send" }).click();
    await phone.locator("li[data-message]", { hasText: `Phone check ${n}:` }).waitFor({ timeout: 30000 });
    await phone.waitForTimeout(300);
  }
  let v = await inView();
  assert.ok(v.boxVisible, "the message box is on screen without scrolling");
  assert.ok(v.scrollable && v.fromBottom < 5, `sending keeps you at the newest message (${v.fromBottom}px from the bottom)`);
  await go(phone, `/causes/${trail}/chat`);
  await phone.waitForTimeout(800);
  v = await inView();
  assert.ok(v.fromBottom < 5, "it opens at the newest message");
  assert.match(await phone.getByRole("separator").first().getAttribute("aria-label"), /Today|Yesterday|day|\d/);
  // Grouped: Sam's five messages in a row show his name at most once.
  await phone.evaluate(() => (document.querySelector("[data-chat-scroll]").scrollTop = 0));
  await go(alex, `/causes/${trail}/chat`);
  await alex.getByLabel("Your message").fill("Great, I'll bring the gloves.");
  await alex.getByRole("button", { name: "Send" }).click();
  await phone.getByRole("button", { name: "New messages ↓" }).waitFor({ timeout: 30000 });
  assert.ok((await inView()).fromBottom > 50, "someone scrolled up stays where they were");
  await phone.getByRole("button", { name: "New messages ↓" }).click();
  await phone.waitForFunction(() => {
    const s = document.querySelector("[data-chat-scroll]");
    return s.scrollHeight - s.scrollTop - s.clientHeight < 5;
  });
  await phone.getByText("Great, I'll bring the gloves.").waitFor();
  await phone.context().close();
  step("Phone chat: the box is in view, it opens and stays at the newest message, and 'New messages ↓' when scrolled up");

  // 19. See who's in (#79). Priya's Members list; Sam turns his name off and shows as "A neighbour" to Alex, not to Priya.
  const priya2 = await signIn(browser, "priya@demo.test", opts);
  await go(priya2, `/causes/${park}/events`); // her seeded event went when she deleted her account in step 5
  await priya2.getByText("+ Organize an event").click();
  const infoNight = priya2.locator("form", { has: priya2.getByRole("button", { name: "Create meetup" }) });
  await infoNight.getByLabel("Title").fill("Tenants meeting");
  await infoNight.getByLabel("Starts").fill(`${ymd}T19:00`);
  await infoNight.getByLabel("Where").fill("Fort York library");
  await Promise.all([priya2.waitForURL(/\/events\/\w+/, { timeout: 60000, waitUntil: "commit" }), infoNight.getByRole("button", { name: "Create meetup" }).click()]);
  await settle(priya2);
  await go(priya2, `/causes/${park}`);
  await priya2.locator("details#members > summary").click();
  const memberList = priya2.getByRole("list", { name: "Members" });
  const samRow = memberList.locator("li", { hasText: "Sam" });
  assert.match(await samRow.innerText(), /from the flyer[\s\S]*✓ Signed[\s\S]*Not going/);
  assert.match(await memberList.locator("li", { hasText: "Alex" }).innerText(), /from your invite/);
  assert.doesNotMatch(await memberList.innerText(), /@/, "emails are never shown");
  await priya2.getByLabel("Filter members").selectOption("not_going");
  assert.equal(await memberList.locator("li", { hasText: "Priya" }).count(), 0, "the host is going, so she's filtered out");
  assert.equal(await samRow.count(), 1);
  await go(page, `/causes/${park}`);
  assert.equal(await page.locator("details#members").count(), 0, "members don't see the list");
  assert.match(await text(page), /“=1\+1 "my rent" went up” — Sam/, "Sam sees his own name");
  await go(page, "/me");
  await page.getByLabel(/Show my name on causes I join/).uncheck();
  await page.getByRole("button", { name: "Save privacy setting" }).click();
  // Wait until it's saved: a fresh load shows it off.
  for (let tries = 0; tries < 10; tries++) {
    await page.waitForTimeout(1500);
    await go(page, "/me");
    if (!(await page.getByLabel(/Show my name on causes I join/).isChecked())) break;
    assert.notEqual(tries, 9, "the setting should save");
  }
  await go(alex, `/causes/${park}`);
  assert.match(await text(alex), /Priya, Alex and 1 neighbour have joined/, "he's just counted in who's joined");
  assert.match(await text(alex), /“=1\+1 "my rent" went up” — Sam/, "Alex is the demo moderator, so he still sees the name");
  await go(priya2, `/causes/${park}`);
  assert.match(await text(priya2), /“=1\+1 "my rent" went up” — Sam/, "the leader still sees the name");
  await priya2.locator("details#members > summary").click();
  assert.match(await priya2.getByRole("list", { name: "Members" }).locator("li", { hasText: "Sam" }).innerText(), /shows as .a neighbour. to others/);
  await priya2.context().close();
  const visitor = await (await browser.newContext(opts)).newPage();
  await go(visitor, `/causes/${park}`);
  const visitorSees = await text(visitor);
  assert.match(visitorSees, /“=1\+1 "my rent" went up” — A neighbour/, "everyone else sees 'A neighbour'");
  assert.doesNotMatch(visitorSees, /\bSam\b/, "and never the name");
  assert.match(visitorSees, /The people leading this cause can see that you joined/, "the Join button says who can see it");
  await visitor.context().close();
  step("A leader sees Members with signed/going; with the setting off, Sam is 'A neighbour' to others but named to the leader");

  // 20. Leaders keep their own chat clean (#71). Priya leads the crossing now: she hides Sam's message; Alex, the moderator, sees it and undoes it.
  const priya3 = await signIn(browser, "priya@demo.test", opts);
  await go(priya3, `/causes/${CAUSE}/chat`);
  const samsMessage = priya3.locator("li[data-message]", { hasText: "Counted 5 near-misses" });
  await samsMessage.getByLabel("Message options").click();
  await samsMessage.getByRole("button", { name: "Hide", exact: true }).click();
  await priya3.getByText("Hidden by the people leading this cause").first().waitFor({ timeout: 30000 });
  assert.doesNotMatch(await text(priya3), /Counted 5 near-misses/, "the words are gone for everyone but the author");
  const moderatorsMessage = priya3.locator("li[data-message]", { hasText: "I emailed the city" });
  await moderatorsMessage.getByLabel("Message options").click();
  assert.equal(await moderatorsMessage.getByRole("button", { name: "Hide", exact: true }).count(), 0, "leaders can't hide a moderator's message");
  await go(alex, "/admin/reports");
  const queue = await text(alex);
  assert.match(queue, /Hidden by someone leading this cause/, "hiding files a report");
  assert.match(queue, /What leaders did[\s\S]*hid a message by/, "and it's in the log");
  await alex.getByRole("button", { name: "Undo: show the message" }).first().click();
  await alex.getByRole("button", { name: "Undo: show the message" }).waitFor({ state: "detached", timeout: 30000 });
  await go(priya3, `/causes/${CAUSE}/chat`);
  assert.match(await text(priya3), /Counted 5 near-misses/, "a moderator can undo it");
  step("A leader hides a message: others see a placeholder, moderators get a report and a log entry, and can undo it");

  // Priya removes Sam from her cause; he's told why and can't rejoin, until a moderator lifts it.
  await go(priya3, `/causes/${park}`);
  await priya3.locator("details#members > summary").click();
  const people = priya3.getByRole("list", { name: "Members" });
  assert.equal(await people.locator("li", { hasText: "Alex" }).getByText("Remove from this cause").count(), 0, "a moderator can't be removed");
  const samListed = people.locator("li", { hasText: "Sam" });
  await samListed.locator("summary", { hasText: "Remove from this cause" }).click();
  await samListed.getByLabel("Why? (they'll see this)").fill("Repeated spam after being asked to stop.");
  await samListed.getByRole("button", { name: "Remove from this cause" }).click();
  await samListed.waitFor({ state: "detached", timeout: 30000 });
  await go(page, `/causes/${park}`);
  const removedView = await text(page);
  assert.match(removedView, /removed you from it\. They said: .Repeated spam after being asked to stop\./, "he's told why");
  assert.equal(await page.locator("main").getByRole("button", { name: "Join this cause" }).count(), 0, "and can't rejoin");
  await go(alex, "/admin/reports");
  await alex.getByRole("button", { name: "Undo: let them rejoin" }).first().click();
  await alex.getByRole("button", { name: "Undo: let them rejoin" }).waitFor({ state: "detached", timeout: 30000 });
  await go(page, `/causes/${park}`);
  await page.locator("main").getByRole("button", { name: "Join this cause" }).first().waitFor({ timeout: 30000 });
  await priya3.context().close();
  step("A leader removes someone: they're told why and can't rejoin, until a moderator lifts it");

  // 21. Announcements (#73). Priya posts: it's pinned for members; Sam (push on) hears now, Alex gets one daily email.
  await page.locator("main").getByRole("button", { name: "Join this cause" }).first().click();
  await page.getByText("✓ Joined").first().waitFor({ timeout: 30000 });
  const priya4 = await signIn(browser, "priya@demo.test", opts);
  const postNews = async (body) => {
    await go(priya4, `/causes/${park}`);
    const tool = priya4.locator("details", { hasText: "Post an announcement" });
    await tool.getByText("📢 Post an announcement").click();
    await tool.getByLabel("Your announcement").fill(body);
    await tool.getByRole("button", { name: "Post announcement" }).click();
    await tool.getByText(/^Posted\.$|posted 3 this week/).waitFor({ timeout: 30000 }); // the third fills the week, so the form gives way to that
  };
  await postNews("The tenants meeting moved to Thursday at 7.");
  await postNews("Bring your rent notices on Thursday.");
  await go(alex, `/causes/${park}/chat`);
  const pinnedNews = alex.getByRole("complementary", { name: "Announcement" });
  assert.match(await pinnedNews.innerText(), /Bring your rent notices/, "the latest is pinned");
  assert.doesNotMatch(await pinnedNews.innerText(), /moved to Thursday/, "and it replaces the one before");
  assert.equal(await pinnedNews.getByRole("button", { name: "Unpin" }).count(), 0, "members can't unpin");
  // Notifications (#95): under the name icon, with an unread count, and on /me. Telling people happens just after the post, so allow a moment.
  const unreadBadge = alex.getByTestId("unread-count");
  for (let tries = 0; tries < 10 && !(await unreadBadge.count()); tries++) {
    await alex.waitForTimeout(1500);
    await go(alex, `/causes/${park}/chat`);
  }
  assert.equal(await unreadBadge.count(), 1, "the name icon shows an unread count");
  const nameIcon = alex.getByRole("button", { name: /notifications and your activity/ });
  await nameIcon.click();
  const dropdown = alex.getByRole("region", { name: "Notifications" });
  assert.match(await dropdown.innerText(), /News from "Rent increases[\s\S]*Bring your rent notices/, "the dropdown lists it");
  await unreadBadge.waitFor({ state: "detached", timeout: 30000 });
  await dropdown.getByRole("link", { name: /Bring your rent notices/ }).first().click();
  await alex.waitForURL(new RegExp(`/causes/${park}/chat`), { timeout: 30000 });
  await alex.waitForTimeout(1500);
  await go(alex, `/causes/${park}`);
  assert.equal(await unreadBadge.count(), 0, "opening them marks them read");
  await go(alex, "/me");
  assert.match(await alex.locator("#notifications").innerText(), /News from "Rent increases[\s\S]*moved to Thursday/, "and they're on the profile page too");
  await go(priya4, "/me");
  assert.doesNotMatch(await priya4.locator("#notifications").innerText(), /News from "Rent increases/, "the author isn't told about their own");
  await go(page, "/me");
  assert.match(await page.locator("#notifications").innerText(), /You were removed from "Rent increases[\s\S]*Repeated spam/, "a removal shows there, with the reason");
  const dailyRun = await runDailyEmails();
  assert.equal(dailyRun.announced, undefined, "announcements aren't emailed");
  step("Notifications: unread count on the name icon, a dropdown that links to the right page, marked read when opened, and listed on /me");

  await postNews("Third and last one this week.");
  await go(priya4, `/causes/${park}`);
  await priya4.getByText("📢 Post an announcement").click();
  assert.match(await priya4.locator("details", { hasText: "Post an announcement" }).innerText(), /You.ve posted 3 this week/, "at most 3 a week");
  await go(priya4, `/causes/${park}/chat`);
  await priya4.getByRole("complementary", { name: "Announcement" }).getByRole("button", { name: "Unpin" }).click();
  await priya4.getByRole("complementary", { name: "Announcement" }).waitFor({ state: "detached", timeout: 30000 });
  await priya4.context().close();
  step("Announcements: pinned in the chat, at most 3 a week, and the leader can unpin");

  // 22. Recurring events (#78). Priya sets up a weekly meeting, 6 times; the next 4 show; she changes the future ones and cancels one, then the rest.
  const priya5 = await signIn(browser, "priya@demo.test", opts);
  await go(priya5, `/causes/${park}/events`);
  await priya5.getByText("+ Organize an event").click();
  const weeklyForm = priya5.locator("form", { has: priya5.getByRole("button", { name: "Create meetup" }) });
  await weeklyForm.getByLabel("Title").fill("Weekly tenants check-in");
  await weeklyForm.getByLabel("Starts").fill(`${ymd}T18:30`);
  await weeklyForm.getByLabel("Where").fill("Fort York library");
  await weeklyForm.getByLabel("Repeats").selectOption("weekly");
  await weeklyForm.getByLabel("How many times").fill("6");
  await Promise.all([priya5.waitForURL(/\/events\/\w+/, { timeout: 60000, waitUntil: "commit" }), weeklyForm.getByRole("button", { name: "Create meetup" }).click()]);
  await settle(priya5);
  assert.match(await text(priya5), /Repeats every week/);
  await go(priya5, `/causes/${park}/events`);
  const weekly = priya5.locator("section", { has: priya5.getByRole("heading", { name: "Weekly tenants check-in" }) });
  assert.equal(await weekly.count(), 4, "the next 4 show");
  assert.match(await weekly.nth(3).innerText(), /2 more dates after this/);
  const whenOf = async (i) => (await weekly.nth(i).locator("time").getAttribute("datetime"));
  const week = 7 * 24 * 60 * 60 * 1000;
  const firstAt = new Date(await whenOf(0)).getTime();
  assert.ok(Math.abs(new Date(await whenOf(1)).getTime() - firstAt - week) <= 60 * 60 * 1000, "a week apart (give or take a clock change)");
  // People say they're going per meeting.
  const secondHref = await weekly.nth(1).getByRole("link", { name: "Weekly tenants check-in" }).getAttribute("href");
  await go(alex, secondHref);
  await alex.getByRole("button", { name: "I'll be there" }).click();
  await waitText(alex, /You're going/);
  await go(alex, `/causes/${park}/events`);
  const alexWeekly = alex.locator("section", { has: alex.getByRole("heading", { name: "Weekly tenants check-in" }) });
  assert.match(await alexWeekly.nth(1).innerText(), /✓ Going/);
  assert.match(await alexWeekly.nth(0).innerText(), /I'll be there/, "going to one isn't going to all");
  // Change this and all future ones, from the second.
  await go(priya5, secondHref);
  await priya5.getByText("Edit event details").click();
  await priya5.locator("form", { has: priya5.getByRole("button", { name: "Save changes" }) }).locator('input[name="location"]').fill("Community room, 2nd floor");
  await priya5.getByLabel("This and all future meetings").check();
  await priya5.getByRole("button", { name: "Save changes" }).click();
  await priya5.getByText("Saved.").waitFor({ timeout: 30000 });
  await go(priya5, `/causes/${park}/events`);
  assert.match(await weekly.nth(0).innerText(), /Fort York library/, "the one before is unchanged");
  assert.match(await weekly.nth(1).innerText(), /Community room/);
  assert.match(await weekly.nth(3).innerText(), /Community room/, "and all future ones changed");
  // Email my list an update (#95): opens her own email app, with her own list in BCC. Nothing is uploaded.
  await go(priya5, secondHref);
  await priya5.locator("#email-list summary").click();
  const listBox = priya5.locator("#email-list");
  const plainMail = await listBox.getByRole("link", { name: "Open in my email" }).getAttribute("href");
  assert.match(plainMail, /^mailto:\?subject=Update/, "it opens her own email with the message ready");
  assert.doesNotMatch(plainMail, /bcc=/, "and no addresses until she adds her list");
  await listBox.locator('input[type="file"]').setInputFiles({ name: "list.csv", mimeType: "text/csv", buffer: Buffer.from("Name,Email\nMaya,maya.update@example.com\n") });
  await listBox.getByRole("status").waitFor({ timeout: 30000 });
  assert.match(decodeURIComponent(await listBox.getByRole("link", { name: "Open in my email" }).getAttribute("href")), /^mailto:\?bcc=maya\.update@example\.com&subject=Update/);
  step("Email my list: a host's update opens their own email, with their own list in BCC");
  // Cancel just the second.
  await go(priya5, secondHref);
  await priya5.locator("#cancel summary").click();
  await Promise.all([priya5.waitForURL(new RegExp(`/causes/${park}/events`), { timeout: 60000, waitUntil: "commit" }), priya5.getByRole("button", { name: "Cancel just this one" }).click()]);
  await settle(priya5);
  assert.equal(await weekly.count(), 4, "the next one takes its place");
  assert.match(await weekly.nth(3).innerText(), /1 more date after this/, "one fewer in the series");
  // Cancel from the third on (taking its link first, as the list is on screen now).
  const thirdHref = await weekly.nth(1).getByRole("link", { name: "Weekly tenants check-in" }).getAttribute("href");
  await go(priya5, secondHref);
  assert.doesNotMatch(await text(priya5), /Weekly tenants check-in/, "the cancelled one is gone");
  await go(priya5, thirdHref);
  await priya5.locator("#cancel summary").click();
  await Promise.all([priya5.waitForURL(new RegExp(`/causes/${park}/events`), { timeout: 60000, waitUntil: "commit" }), priya5.getByRole("button", { name: "Cancel this and all future ones" }).click()]);
  await settle(priya5);
  assert.equal(await weekly.count(), 1, "only the first is left");
  await priya5.context().close();
  step("Recurring events: the next 4 show, going is per meeting, the host changes all future ones and cancels one or the rest");

  await alex.context().close();
  await page.context().close();
}

await browser.close();
console.log("All flows passed.");
