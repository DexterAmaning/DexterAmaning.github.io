// Renders the social preview image and full-page screenshots for review.
//   site/assets/img/og-image.png       1200x630 social card
//   docs/screenshots/<page>-<view>.png desktop (1440) and phone (390), light; home also in dark
// docs/screenshots/ is git-ignored. Any existing set is moved to docs/screenshots/previous/<time>/ first.
import { mkdirSync, readdirSync, renameSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { PAGES, ROOT, launchBrowser, startServer } from "./lib.mjs";

const out = join(ROOT, "docs", "screenshots");
mkdirSync(out, { recursive: true });

// Never overwrite review screenshots: archive the current set first.
const existing = readdirSync(out).filter((f) => f.endsWith(".png"));
if (existing.length) {
  const archive = join(out, "previous", new Date().toISOString().replace(/[:.]/g, "-"));
  mkdirSync(archive, { recursive: true });
  for (const f of existing) renameSync(join(out, f), join(archive, f));
  console.log(`Archived ${existing.length} earlier screenshots to ${archive.replace(ROOT, "").replace(/\\/g, "/")}`);
}

const { server, origin } = await startServer();
const browser = await launchBrowser();
try {
  const og = await browser.newPage();
  await og.setViewport({ width: 1200, height: 630 });
  await og.goto(pathToFileURL(join(ROOT, "scripts", "og-image.html")).href, { waitUntil: "load" });
  await og.evaluate(() => document.fonts.ready);
  await og.screenshot({ path: join(ROOT, "site", "assets", "img", "og-image.png") });
  await og.close();
  console.log("✓ site/assets/img/og-image.png");

  const shots = [
    { view: "desktop", width: 1440, height: 900, deviceScaleFactor: 1 },
    { view: "phone", width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  ];
  for (const p of PAGES.filter((p) => !p.utility)) {
    const name = p.path.replace(/^projects\//, "").replace(/\.html$/, "");
    for (const s of shots) {
      for (const scheme of p.path === "index.html" || s.view === "desktop" && p.path.includes("medicaid") ? ["light", "dark"] : ["light"]) {
        const page = await browser.newPage();
        await page.setViewport(s);
        await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: scheme }]);
        await page.goto(`${origin}/${p.path}`, { waitUntil: "networkidle0" });
        await page.evaluate(() => document.fonts.ready);
        // Lazy images load before the capture.
        await page.evaluate(() => Promise.all([...document.images].map((i) => { i.loading = "eager"; return i.decode().catch(() => {}); })));
        const file = join(out, `${name}-${s.view}${scheme === "dark" ? "-dark" : ""}.png`);
        await page.screenshot({ path: file, fullPage: true });
        await page.close();
        console.log(`✓ ${file.replace(ROOT, "").replace(/\\/g, "/")}`);
      }
    }
  }
} finally {
  await browser.close();
  server.close();
}
