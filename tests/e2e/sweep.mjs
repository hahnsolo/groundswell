// Visual sweep: every page × phone/tablet/desktop × light/dark, with automatic
// checks for horizontal overflow and low-contrast text. Saves a screenshot of
// each view and a contact sheet per page in tests/e2e/output/sweep/.
// Needs demo data plus the awkward content (`npm run db:seed`, then `npm run e2e:data`).
import { mkdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import { CONTEXT, OUT, findCause, go, launch, settle, signIn } from "./helpers.mjs";

const DIR = `${OUT}sweep/`;
mkdirSync(DIR, { recursive: true });
const SIZES = [
  { name: "phone", width: 360, height: 780 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 900 },
];
const SCHEMES = ["light", "dark"];

const browser = await launch();

// Runs in the page: things wider than the screen, and text with poor contrast.
function audit() {
  const W = document.documentElement.clientWidth;
  const issues = [];
  if (document.documentElement.scrollWidth > W + 1) issues.push(`page scrolls sideways (${document.documentElement.scrollWidth}px wide on a ${W}px screen)`);
  const inScroller = (el) => {
    for (let p = el.parentElement; p; p = p.parentElement) {
      const o = getComputedStyle(p).overflowX;
      if (o === "auto" || o === "scroll" || o === "hidden") return true;
    }
    return false;
  };
  const label = (el) => {
    const t = (el.innerText || el.getAttribute("aria-label") || el.tagName).trim().replace(/\s+/g, " ");
    return `<${el.tagName.toLowerCase()}> "${t.slice(0, 60)}"`;
  };
  const seen = new Set();
  for (const el of document.querySelectorAll("body *")) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const s = getComputedStyle(el);
    if (s.visibility === "hidden" || s.display === "none" || s.position === "fixed") continue;
    if ((r.right > W + 1 || r.left < -1) && !inScroller(el) && el.children.length === 0) {
      const key = "overflow " + label(el);
      if (!seen.has(key)) { seen.add(key); issues.push(`sticks out of the screen: ${label(el)} (${Math.round(r.left)}–${Math.round(r.right)}px)`); }
    }
  }
  // Contrast: text elements against the first solid background behind them.
  // Let the browser convert any CSS colour (oklch, color-mix…) to plain RGBA by painting one pixel.
  const cv = document.createElement("canvas");
  cv.width = cv.height = 1;
  const cx = cv.getContext("2d", { willReadFrequently: true });
  const parse = (c) => {
    cx.clearRect(0, 0, 1, 1);
    cx.fillStyle = "rgba(0,0,0,0)";
    cx.fillStyle = c;
    cx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = cx.getImageData(0, 0, 1, 1).data;
    return [r, g, b, a / 255];
  };
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const bgOf = (el) => {
    for (let p = el; p; p = p.parentElement) {
      const c = parse(getComputedStyle(p).backgroundColor);
      if (c.length < 4 || c[3] > 0.9) return c;
    }
    return [255, 255, 255, 1];
  };
  for (const el of document.querySelectorAll("body *")) {
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1);
    if (!own) continue;
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (r.width === 0 || s.visibility === "hidden" || Number(s.opacity) < 0.5) continue;
    const fg = parse(s.color), bg = bgOf(el);
    if (fg.length >= 4 && fg[3] < 0.5) continue;
    const a = lum(fg), b = lum(bg);
    const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    const large = parseFloat(s.fontSize) >= 18.66 || (parseFloat(s.fontSize) >= 14 && Number(s.fontWeight) >= 700);
    if (ratio < (large ? 3 : 4.5)) {
      const key = "contrast " + label(el);
      if (!seen.has(key)) { seen.add(key); issues.push(`hard to read (contrast ${ratio.toFixed(1)}:1): ${label(el)}`); }
    }
  }
  return issues;
}

const report = [];
async function sweep(page, name, path, prepare) {
  const shots = [];
  for (const scheme of SCHEMES) {
    await page.emulateMedia({ colorScheme: scheme });
    for (const size of SIZES) {
      await page.setViewportSize({ width: size.width, height: size.height });
      await go(page, path);
      if (prepare) await prepare(page).catch((e) => report.push({ name, size: size.name, scheme, issues: [`couldn't prepare: ${e.message.split("\n")[0]}`] }));
      await page.waitForTimeout(200);
      const issues = await page.evaluate(audit);
      report.push({ name, size: size.name, scheme, issues });
      const file = `${DIR}${name}-${scheme}-${size.name}.png`;
      await page.screenshot({ path: file, fullPage: true });
      shots.push({ file, size, scheme });
    }
  }
  // Contact sheet: light on top, dark below; phone, tablet, desktop left to right, each cut at 1600px tall.
  const tiles = await Promise.all(
    shots.map(async (s) => {
      const img = sharp(s.file);
      const meta = await img.metadata();
      const h = Math.min(meta.height, 1600);
      const buf = await img.extract({ left: 0, top: 0, width: meta.width, height: h }).resize({ width: Math.round(meta.width * 0.5) }).png().toBuffer();
      return { buf, w: Math.round(meta.width * 0.5), h: Math.round(h * 0.5), s };
    }),
  );
  const colX = [0, 190, 590];
  const rowH = Math.max(...tiles.map((t) => t.h));
  await sharp({ create: { width: 590 + 640, height: rowH * 2 + 10, channels: 3, background: "#888" } })
    .composite(tiles.map((t) => ({ input: t.buf, left: colX[SIZES.findIndex((z) => z.name === t.s.size.name)], top: t.s.scheme === "light" ? 0 : rowH + 10 })))
    .png()
    .toFile(`${DIR}sheet-${name}.png`);
  console.log("swept", name);
}

// Signed out
let AWK;
{
  const page = await (await browser.newContext(CONTEXT)).newPage();
  AWK = await findCause(page, "/area/ca/M5V", "Supercalifragilistic");
  await sweep(page, "home-welcome", "/");
  await sweep(page, "signin", "/signin");
  await sweep(page, "signup", "/signup");
  await sweep(page, "forgot", "/forgot-password");
  await sweep(page, "not-found", "/causes/nope");
  await sweep(page, "offline", "/offline");
  await sweep(page, "area-empty", "/area/us/99501");
  await sweep(page, "cause-signed-out", `/causes/${AWK}`);
  await sweep(page, "chat-locked", `/causes/${AWK}/chat`);
  await sweep(page, "goodbye", "/goodbye");
  await page.context().close();
}
// Signed in as Alex (admin, member of the awkward cause)
{
  const page = await signIn(browser, "alex@demo.test");
  await sweep(page, "home-returning", "/area/ca/M5V"); // sets the neighbourhood…
  await sweep(page, "home-returning", "/"); // …then the home page uses it
  await sweep(page, "area-busy", "/area/ca/M5V");
  await sweep(page, "cause-about", `/causes/${AWK}`, async (p) => {
    for (const s of await p.locator("summary").all()) await s.click().catch(() => {});
  });
  await sweep(page, "cause-chat", `/causes/${AWK}/chat`);
  await sweep(page, "cause-events", `/causes/${AWK}/events`, (p) => p.getByText("+ Organize an event").click());
  await go(page, `/causes/${AWK}/events`);
  await settle(page);
  const eventHref = await page.locator('a[href^="/events/"]').first().getAttribute("href");
  await sweep(page, "event-page", eventHref);
  await sweep(page, "events-nearby", "/events?radius=50");
  await sweep(page, "new-issue", "/causes/new?country=CA&postal=M5V");
  await sweep(page, "me", "/me", (p) => p.getByText("Delete my account…").click());
  await sweep(page, "admin-queue", "/admin/reports");
  await sweep(page, "picker-open", "/area/ca/M5V", (p) => p.getByRole("button", { name: /Your neighbourhood/ }).click());
  await page.context().close();
}
await browser.close();
writeFileSync(`${DIR}report.json`, JSON.stringify(report, null, 2));
const bad = report.filter((r) => r.issues.length);
for (const r of bad) console.log(`\n${r.name} (${r.size}, ${r.scheme}):\n  - ${r.issues.join("\n  - ")}`);
console.log(`\n${report.length} views checked, ${bad.length} with findings`);
if (bad.length) process.exitCode = 1;
