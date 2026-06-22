// shot.mjs — render the extension in headless Chromium (under xvfb) and screenshot
// the newtab page, so Claude can SEE what it builds without the user's Chrome.
//
// Usage (via tools/shot.sh):
//   node tools/shot.mjs --theme=dark|light --seed=0|1 --out=docs/shots/x.png
//
// --seed=1 pre-fills config (football + a few leagues) so the Sport widget renders
// with data. A clean profile means no Google login -> Gmail/Agenda show empty states.

import { chromium } from "playwright-core";
import path from "node:path";
import { fileURLToPath } from "node:url";

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const m = a.match(/^--([^=]+)=(.*)$/); return m ? [m[1], m[2]] : [a.replace(/^--/, ""), true];
}));
const THEME = args.theme === "light" ? "light" : "dark";
const SEED = args.seed === "1" || args.seed === true;
const OUT = args.out || `docs/shots/newtab-${THEME}.png`;

const EXT = path.resolve(fileURLToPath(new URL("..", import.meta.url))); // repo root = extension dir
const PROFILE = args.profile || "/tmp/nt-profile";

const ctx = await chromium.launchPersistentContext(PROFILE, {
  executablePath: process.env.CHROMIUM_BIN || "/usr/bin/chromium",
  headless: false, // extensions require a headed context; we run under xvfb
  viewport: { width: 1440, height: 900 },
  args: [
    `--disable-extensions-except=${EXT}`,
    `--load-extension=${EXT}`,
    "--no-sandbox",
    "--no-first-run",
    "--no-default-browser-check",
  ],
});

// discover the extension id from its MV3 service worker (fixed by manifest `key`)
let [sw] = ctx.serviceWorkers();
if (!sw) sw = await ctx.waitForEvent("serviceworker", { timeout: 8000 }).catch(() => null);
const id = sw ? new URL(sw.url()).host : "ekpdcllabebccofbdifmeemflbncgiih";
console.log("[shot] extension id:", id, "| theme:", THEME, "| seed:", SEED);

const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));

const url = `chrome-extension://${id}/newtab.html`;
await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });

// seed theme/lang/config, then reload so everything renders from the seeded state
await page.evaluate(async ({ theme, seed }) => {
  try { localStorage.setItem("theme", theme); localStorage.setItem("lang", "fr"); } catch (e) {}
  try { await chrome.storage.local.set({ onboarded: true }); } catch (e) {}
  if (seed) {
    try {
      await chrome.storage.sync.set({
        config: { sports: ["football", "f1"], follows: { football: [
          { type: "team", id: "524", name: "PSG", comp: "FL1" },
          { type: "team", id: "57", name: "Arsenal", comp: "PL" },
          { type: "league", comp: "FL1" }, { type: "league", comp: "CL" },
        ] }, sportCfg: { rotate: 0, mode: "manual" } },
      });
    } catch (e) {}
  }
}, { theme: THEME, seed: SEED });

await page.reload({ waitUntil: "domcontentloaded", timeout: 15000 });
await page.waitForTimeout(3000); // let widgets fetch (ESPN/news/stocks) and the SW fill cache

// optional: open the onboarding and advance N steps (verification)
if (args.onboard != null) {
  await page.evaluate(() => { window.Onboarding && window.Onboarding.start(); });
  await page.waitForTimeout(400);
  for (let i = 0; i < Number(args.onboard); i++) { await page.click(".ob-next").catch(() => {}); await page.waitForTimeout(350); }
  if (args.obfoot) {
    await page.click('.ob-chip:has-text("Football")').catch(() => {});
    await page.waitForTimeout(500);
    await page.click('.ms-field').catch(() => {});                       // open the dropdown
    await page.waitForTimeout(300);
    await page.click('.ms-opt:has-text("Ligue 1")').catch(() => {});     // select one -> tag + check
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(600);
}

// optional: click a selector (e.g. #sport) to open a full-screen view, then shoot
if (args.click) {
  await page.click(args.click, { timeout: 5000 }).catch((e) => console.log("[shot] click failed:", e.message));
  await page.waitForTimeout(1500);
}

await page.screenshot({ path: OUT, fullPage: true });
console.log("[shot] saved:", OUT);
if (errors.length) console.log("[shot] console errors:\n  - " + errors.slice(0, 20).join("\n  - "));
else console.log("[shot] no console errors");

await ctx.close();
process.exit(0);
