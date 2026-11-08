// Records exactly what a browser sends when an open chat refreshes itself, so the
// load test can send the same thing. Blocks the live connection, so the chat falls
// back to checking every 10 seconds.
import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright-core";

const BASE = "http://localhost:3000";
const out = new URL("./output/", import.meta.url);
const { busyCause, cookies } = JSON.parse(readFileSync(new URL("./sessions.json", out), "utf8"));
const browser = await chromium.launch({ channel: process.env.E2E_BROWSER ?? "msedge", headless: true });
const context = await browser.newContext();
const [name, value] = cookies[1].split(/=(.*)/s);
await context.addCookies([{ name, value, domain: "localhost", path: "/" }]);
const page = await context.newPage();
await page.routeWebSocket(/.*/, (ws) => ws.close());
const chat = `${BASE}/causes/${busyCause}/chat`;
await page.goto(chat, { waitUntil: "domcontentloaded", timeout: 120000 });
const response = await page.waitForResponse((r) => r.url().startsWith(chat) && r.request().method() === "GET" && !!r.request().headers().rsc && !r.request().headers()["next-router-prefetch"], { timeout: 120000 });
const headers = await response.request().allHeaders();
const body = await response.body();
const keep = Object.fromEntries(Object.entries(headers).filter(([k]) => k === "rsc" || k.startsWith("next-")));
writeFileSync(new URL("./refresh.json", out), JSON.stringify({ url: response.url().replace(BASE, ""), headers: keep }));
console.log("status", response.status(), "bytes", body.length, "shows messages:", body.includes("about the crossing"));
console.log("headers sent:", Object.keys(keep).join(", "));
console.log("url:", response.url().replace(busyCause, "BUSY"));
await browser.close();
