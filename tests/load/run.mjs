// The load test: browsing, a busy chat room, posting an announcement and the daily
// job, against a LOCAL production build (`npm run build`, `npm start`) using the dev
// database filled by setup.mjs. Local on purpose: running this against Vercel could
// use up free allowances shared with the live site.
//   node tests/load/run.mjs [browse] [chat] [announce] [daily]
import { readFileSync, writeFileSync } from "node:fs";
import { get as httpGet } from "node:http";
import { PrismaClient } from "@prisma/client";
import { chromium } from "playwright-core";

process.loadEnvFile();
const BASE = "http://localhost:3000";
if (process.env.ALLOW_DB_SEED !== "yes" || process.env.VERCEL) throw new Error("Only for your dev database.");

const out = new URL("./output/", import.meta.url);
const { busyCause, leader, cookies } = JSON.parse(readFileSync(new URL("./sessions.json", out), "utf8"));
const asked = process.argv.slice(2);
const wants = (name) => asked.length === 0 || asked.includes(name);
const db = new PrismaClient();
const direct = new PrismaClient({ datasourceUrl: process.env.DIRECT_URL });
const results = {};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pick = (list) => list[Math.floor(Math.random() * list.length)];

function summary(times, errors, seconds) {
  const sorted = [...times].sort((a, b) => a - b);
  const at = (p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0;
  return { requests: times.length, perSecond: +(times.length / seconds).toFixed(1), p50ms: Math.round(at(0.5)), p95ms: Math.round(at(0.95)), maxms: Math.round(sorted.at(-1) ?? 0), errors };
}

async function hit(path, options = {}) {
  const start = performance.now();
  const res = await fetch(BASE + path, { redirect: "manual", signal: AbortSignal.timeout(30000), headers: { ...(options.cookie ? { cookie: options.cookie } : {}), ...(options.headers ?? {}) } });
  await res.arrayBuffer();
  return { ms: performance.now() - start, ok: res.status < 400, status: res.status };
}

/** Database statements a request causes, counted by Postgres itself. */
async function statements(work) {
  const count = async () => Number((await direct.$queryRaw`SELECT xact_commit FROM pg_stat_database WHERE datname = current_database()`)[0].xact_commit);
  await sleep(1500);
  const before = await count();
  await work();
  await sleep(1500);
  return (await count()) - before - 1;
}

// How far the database is from here. On Vercel it's next door, so database time here overstates it.
const rtt = [];
for (let i = 0; i < 15; i++) {
  const s = performance.now();
  await db.$queryRaw`SELECT 1`;
  rtt.push(performance.now() - s);
}
results.databaseRoundTripMs = Math.round(rtt.sort((a, b) => a - b)[7]);
console.log("Database round trip:", results.databaseRoundTripMs, "ms");

// Is the sign-in real? Otherwise everything below would measure the wrong page.
const me = await hit("/me", { cookie: cookies[1] });
if (me.status !== 200) throw new Error(`Test sign-in didn't work: /me gave ${me.status}`);

const chatPath = `/causes/${busyCause}/chat`;
// How open chats catch up: "new" fetches only new messages (#101); "page" reloads the
// whole chat, as before, replaying what capture-refresh.mjs recorded. CHAT_MODE=page to compare.
const MODE = process.env.CHAT_MODE === "page" ? "page" : "new";
const refresh = wants("chat") && MODE === "page" ? JSON.parse(readFileSync(new URL("./refresh.json", out), "utf8")) : null;

if (wants("browse")) {
  const signedOut = ["/", "/area/CA/M5V", `/causes/${busyCause}`, `/causes/${busyCause}/events`, "/events"];
  const signedIn = ["/me", chatPath, `/causes/${busyCause}`, "/area/CA/M5V"];
  // One at a time first: the cost of each page, with nothing else going on.
  results.pages = {};
  for (const path of [...signedOut, "/me", chatPath]) {
    const cookie = path === "/me" || path === chatPath ? cookies[1] : undefined;
    await hit(path, { cookie });
    const times = [];
    const queries = await statements(async () => {
      for (let i = 0; i < 3; i++) times.push((await hit(path, { cookie })).ms);
    });
    results.pages[path.replace(busyCause, "BUSY")] = { ms: Math.round(times.sort((a, b) => a - b)[1]), statements: Math.round(queries / 3) };
    console.log(path.replace(busyCause, "BUSY"), results.pages[path.replace(busyCause, "BUSY")]);
  }
  results.browse = {};
  for (const people of [5, 10, 25, 50, 100]) {
    const times = [];
    let errors = 0;
    const end = Date.now() + 30000;
    await Promise.all(
      Array.from({ length: people }, async (_, i) => {
        while (Date.now() < end) {
          const out = i % 2 ? { path: pick(signedIn), cookie: pick(cookies) } : { path: pick(signedOut) };
          try {
            const r = await hit(out.path, { cookie: out.cookie });
            times.push(r.ms);
            if (!r.ok) errors++;
          } catch {
            errors++;
          }
        }
      }),
    );
    results.browse[people] = summary(times, errors, 30);
    console.log(`browse, ${people} at once:`, results.browse[people]);
    await sleep(3000);
    if (errors > times.length * 0.05 || results.browse[people].p95ms > 15000) break;
  }
}

if (wants("chat")) {
  // Everyone with the chat open reloads it after each message, at a random moment within 1.5 seconds.
  results.chat = {};
  const everySeconds = 5;
  if (MODE === "new") {
    // The size of one catch-up, with one new message to fetch.
    const before = await db.comment.findFirst({ where: { causeId: busyCause }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { id: true, createdAt: true } });
    await db.comment.create({ data: { causeId: busyCause, authorId: "clu000000000000000000001", body: "Measuring one catch-up." } });
    const url = `${BASE}/causes/${busyCause}/chat/messages?after=${before.id}&at=${encodeURIComponent(before.createdAt.toISOString())}`;
    const bytes = (await (await fetch(url, { headers: { cookie: cookies[1] } })).arrayBuffer()).byteLength;
    results.oneCatchUp = { bytes };
    console.log("one catch-up:", results.oneCatchUp);
  }
  for (const readers of [10, 25, 50, 100, 200, 400, 800, 1600]) {
    const times = [];
    let errors = 0;
    const waiting = [];
    const rounds = 9;
    for (let round = 0; round < rounds; round++) {
      // What open chats already have: since #101 they fetch only what's newer.
      const had = await db.comment.findFirst({ where: { causeId: busyCause }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { id: true, createdAt: true } });
      const newOnly = `/causes/${busyCause}/chat/messages?after=${had.id}&at=${encodeURIComponent(had.createdAt.toISOString())}`;
      await db.comment.create({ data: { causeId: busyCause, authorId: `clu${(round % 100).toString(36).padStart(21, "0")}`, body: `Live message at ${readers} readers, round ${round}.` } });
      for (let r = 0; r < readers; r++) {
        waiting.push(
          sleep(150 + Math.random() * 1350).then(async () => {
            try {
              const res = MODE === "page" ? await hit(refresh.url, { cookie: cookies[r % cookies.length], headers: refresh.headers }) : await hit(newOnly, { cookie: cookies[r % cookies.length] });
              times.push(res.ms);
              if (!res.ok) errors++;
            } catch {
              errors++;
            }
          }),
        );
      }
      await sleep(everySeconds * 1000);
    }
    await Promise.all(waiting);
    results.chat[readers] = summary(times, errors, rounds * everySeconds);
    console.log(`chat, ${readers} open, a message every ${everySeconds}s:`, results.chat[readers]);
    await sleep(5000);
    if (errors > (readers * rounds) * 0.05 || results.chat[readers].p95ms > 20000) break;
  }
}

if (wants("announce")) {
  // A real click on Post announcement, as the leader of the 2,000-member cause.
  const browser = await chromium.launch({ channel: process.env.E2E_BROWSER ?? "msedge", headless: true });
  const context = await browser.newContext();
  const [name, value] = leader.split(/=(.*)/s);
  await context.addCookies([{ name, value, domain: "localhost", path: "/" }]);
  const page = await context.newPage();
  await page.goto(`${BASE}/causes/${busyCause}`, { waitUntil: "domcontentloaded", timeout: 120000 });
  const tool = page.locator("details", { hasText: "Post an announcement" });
  await tool.getByText("📢 Post an announcement").click();
  await tool.getByLabel("Your announcement").fill("Load test: the meeting moved to Thursday at the library.");
  const queries = await statements(async () => {
    const start = performance.now();
    const [response] = await Promise.all([
      page.waitForResponse((r) => r.request().method() === "POST", { timeout: 300000 }),
      tool.getByRole("button", { name: "Post announcement" }).click(),
    ]);
    results.announce = { members: 2000, seconds: +((performance.now() - start) / 1000).toFixed(1), status: response.status() };
  });
  results.announce.statementsToPost = queries;
  // Members are told after the leader's page has finished, so watch the database until it goes quiet.
  const xacts = async () => Number((await direct.$queryRaw`SELECT xact_commit FROM pg_stat_database WHERE datname = current_database()`)[0].xact_commit);
  const told = Date.now();
  const first = await xacts();
  let last = first;
  for (;;) {
    await sleep(10000);
    const nowCount = await xacts();
    const moved = nowCount - last;
    last = nowCount;
    if (moved < 10) break;
  }
  results.announce.tellingSeconds = Math.round((Date.now() - told - 10000) / 1000);
  results.announce.tellingStatements = last - first;
  results.announce.noticesSaved = await db.notification.count({ where: { sourceId: { not: null } } });
  console.log("announcement:", results.announce);
  await browser.close();
}

if (wants("daily")) {
  // Reminders go once per event, so make these due again in case the job already ran.
  await db.meetup.updateMany({ where: { id: { startsWith: "clm" } }, data: { reminderSentAt: null } });
  const callDaily = () =>
    new Promise((resolve, reject) => {
      // Not fetch: it gives up after 5 minutes without an answer, and this may take longer.
      const req = httpGet(`${BASE}/api/cron/daily`, { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } }, (res) => {
        let text = "";
        res.on("data", (d) => (text += d));
        res.on("end", () => resolve({ status: res.statusCode, text }));
      });
      req.on("error", reject);
    });
  let response;
  const start = performance.now();
  const queries = await statements(async () => {
    response = await callDaily();
  });
  let did = null;
  try {
    did = JSON.parse(response.text);
  } catch {}
  results.daily = { seconds: +((performance.now() - start - 3000) / 1000).toFixed(1), status: response.status, statements: queries, did };
  if (results.daily.did?.notifications?.reminded) delete results.daily.did.notifications.reminded;
  console.log("daily job:", JSON.stringify(results.daily));
}

writeFileSync(new URL(`./results-${asked.join("-") || "all"}.json`, out), JSON.stringify(results, null, 2));
await db.$disconnect();
await direct.$disconnect();
console.log("Done.");
