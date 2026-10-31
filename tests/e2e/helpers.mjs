// Shared bits for the browser checks. They drive a LOCAL dev server signed in as
// the demo accounts from prisma/seed.ts, and change its data, so never point
// them anywhere else.
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

export const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) {
  throw new Error(`E2E_BASE_URL must be a local dev server, not ${BASE}`);
}

export const PW = "groundswell-demo"; // public demo password from prisma/seed.ts (local only)
export const OUT = new URL("./output/", import.meta.url).pathname.replace(/^\/(\w:)/, "$1");
mkdirSync(OUT, { recursive: true });

// Uses an installed browser instead of downloading one: Edge by default, or
// E2E_BROWSER=chrome.
export const launch = () => chromium.launch({ channel: process.env.E2E_BROWSER ?? "msedge", headless: true });

export const CONTEXT = { locale: "en-CA", timezoneId: "America/Toronto" };

export async function settle(page) {
  await page.waitForLoadState("networkidle", { timeout: 60000 }).catch(() => {});
  // Wait for Suspense skeletons to be replaced.
  await page.waitForFunction(() => !document.querySelector(".animate-pulse"), null, { timeout: 60000 }).catch(() => {});
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
  await page.waitForTimeout(400);
}

export async function go(page, path) {
  await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 120000 });
  await settle(page);
}

export async function signIn(browser, email, options = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...CONTEXT, ...options });
  const page = await ctx.newPage();
  await go(page, "/signin");
  const form = page.locator("form:visible").filter({ has: page.locator('input[type="password"]') }).first();
  await form.locator('input[name="email"]').fill(email);
  await form.locator('input[name="password"]').fill(PW);
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/signin"), { timeout: 60000 }), form.locator('button[type="submit"]').click()]);
  await settle(page);
  return page;
}

/** The id of the cause whose card on an area page contains `title`. */
export async function findCause(page, areaPath, title) {
  await go(page, areaPath);
  const href = await page.locator('a[href^="/issues/"]', { hasText: title }).first().getAttribute("href", { timeout: 30000 });
  return href.split("/")[2];
}
