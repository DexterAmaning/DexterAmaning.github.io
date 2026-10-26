// Lighthouse (mobile and desktop) for every page against the local server.
// Writes docs/lighthouse/summary.json and prints category scores and key metrics.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import lighthouse from "lighthouse";
import { PAGES, ROOT, launchBrowser, startServer } from "./lib.mjs";

const outDir = join(ROOT, "docs", "lighthouse");
mkdirSync(outDir, { recursive: true });

const { server, origin } = await startServer();
const browser = await launchBrowser();
const port = Number(new URL(browser.wsEndpoint()).port);
const results = [];

try {
  for (const p of PAGES.filter((p) => !p.utility)) {
    for (const formFactor of ["mobile", "desktop"]) {
      const settings = formFactor === "desktop"
        ? { formFactor, screenEmulation: { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false }, throttlingMethod: "simulate", throttling: { rttMs: 40, throughputKbps: 10240, cpuSlowdownMultiplier: 1 } }
        : { formFactor, throttlingMethod: "simulate" };
      const { lhr } = await lighthouse(`${origin}/${p.path}`, { port, output: "json", logLevel: "error" }, {
        extends: "lighthouse:default",
        settings: { ...settings, onlyCategories: ["performance", "accessibility", "best-practices", "seo"] },
      });
      const score = (k) => Math.round(lhr.categories[k].score * 100);
      const audit = (k) => lhr.audits[k]?.displayValue ?? "n/a";
      const failing = Object.values(lhr.audits)
        .filter((a) => a.score !== null && a.score < 0.9 && a.scoreDisplayMode !== "informative" && a.scoreDisplayMode !== "manual" && a.scoreDisplayMode !== "notApplicable")
        .map((a) => a.id);
      const row = {
        page: p.path, formFactor,
        performance: score("performance"), accessibility: score("accessibility"),
        bestPractices: score("best-practices"), seo: score("seo"),
        fcp: audit("first-contentful-paint"), lcp: audit("largest-contentful-paint"),
        cls: audit("cumulative-layout-shift"), tbt: audit("total-blocking-time"),
        transfer: audit("total-byte-weight"), failingAudits: failing,
      };
      results.push(row);
      console.log(`${p.path} [${formFactor}] perf ${row.performance} | a11y ${row.accessibility} | best ${row.bestPractices} | SEO ${row.seo} | LCP ${row.lcp} | CLS ${row.cls} | ${row.transfer}${failing.length ? ` | below 0.9: ${failing.join(", ")}` : ""}`);
    }
  }
} finally {
  await browser.close();
  server.close();
}
writeFileSync(join(outDir, "summary.json"), JSON.stringify(results, null, 2));
console.log("Wrote docs/lighthouse/summary.json");
