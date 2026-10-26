// Accessibility, keyboard and responsive checks in headless Chrome.
//
// For every page, at desktop (1280px) and phone (375px) widths, in light and dark mode:
//  - axe-core with WCAG 2.0/2.1/2.2 A and AA rules plus best practices;
//  - no horizontal page scroll;
//  - no console errors or failed requests.
// Once per page:
//  - the first Tab press lands on a visible skip link;
//  - every focusable element shows a visible focus indicator when tabbed to;
//  - at phone width the menu button opens and closes with the keyboard and Escape.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { PAGES, fail, launchBrowser, startServer } from "./lib.mjs";

const require = createRequire(import.meta.url);
const axeSource = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");

const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 900 },
  { name: "phone", width: 375, height: 812, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
];
const SCHEMES = ["light", "dark"];

const { server, origin } = await startServer();
const browser = await launchBrowser();
const summary = [];

try {
  for (const p of PAGES) {
    for (const vp of VIEWPORTS) {
      for (const scheme of SCHEMES) {
        const page = await browser.newPage();
        const problems = [];
        page.on("console", (m) => m.type() === "error" && problems.push(`console: ${m.text()}`));
        page.on("pageerror", (e) => problems.push(`page error: ${e.message}`));
        page.on("requestfailed", (r) => problems.push(`request failed: ${r.url()}`));
        page.on("response", (r) => {
          if (r.status() >= 400 && !(p.utility && r.url().endsWith("404.html"))) problems.push(`HTTP ${r.status()}: ${r.url()}`);
        });
        await page.setViewport(vp);
        await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: scheme }]);
        await page.goto(`${origin}/${p.path}`, { waitUntil: "networkidle0" });
        await page.evaluate(() => document.fonts.ready);

        await page.evaluate(axeSource);
        const result = await page.evaluate(() =>
          window.axe.run(document, {
            runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"] },
            resultTypes: ["violations", "incomplete"],
          })
        );
        for (const v of result.violations) {
          for (const n of v.nodes) problems.push(`axe ${v.id} (${v.impact}): ${n.target.join(" ")} - ${n.failureSummary?.split("\n")[1]?.trim() ?? v.help}`);
        }
        const incomplete = result.incomplete.reduce((n, v) => n + v.nodes.length, 0);
        const reviewIds = [...new Set(result.incomplete.map((v) => v.id))].join(", ");

        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        if (overflow > 0) problems.push(`horizontal overflow of ${overflow}px`);

        const label = `${p.path} [${vp.name}, ${scheme}]`;
        summary.push({ label, violations: result.violations.length, passes: problems.length === 0, incomplete });
        if (problems.length) {
          fail(label);
          problems.forEach((x) => console.error(`    ${x}`));
        } else {
          console.log(`✓ ${label}: 0 axe violations (${incomplete} items need manual review${reviewIds ? `: ${reviewIds}` : ""}), no overflow, no errors`);
        }
        await page.close();
      }
    }

    // Keyboard checks (light mode).
    for (const vp of VIEWPORTS) {
      const page = await browser.newPage();
      await page.setViewport(vp);
      await page.goto(`${origin}/${p.path}`, { waitUntil: "networkidle0" });
      const label = `${p.path} [${vp.name}, keyboard]`;
      const problems = [];

      await page.keyboard.press("Tab");
      const first = await page.evaluate(() => {
        const el = document.activeElement;
        const r = el.getBoundingClientRect();
        return { cls: el.className, visible: r.top >= 0 && r.bottom <= window.innerHeight && r.width > 0 };
      });
      if (first.cls !== "skip-link" || !first.visible) problems.push(`first Tab stop is "${first.cls}", visible=${first.visible}; expected a visible skip link`);

      // Tab through the page and check each stop has a visible focus indicator.
      const seen = new Set();
      for (let i = 0; i < 120; i++) {
        const info = await page.evaluate(() => {
          const el = document.activeElement;
          if (!el || el === document.body) return null;
          const cs = getComputedStyle(el);
          const host = el.closest(".card") ?? el;
          const hcs = getComputedStyle(host);
          const ring = (cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) >= 2) ||
            (hcs.outlineStyle !== "none" && parseFloat(hcs.outlineWidth) >= 2);
          const r = el.getBoundingClientRect();
          return {
            id: el.outerHTML.slice(0, 80),
            ring,
            displayed: r.width > 0 && r.height > 0,
          };
        });
        if (info) {
          if (seen.has(info.id)) break;
          seen.add(info.id);
          if (!info.ring) problems.push(`no visible focus indicator: ${info.id}`);
          if (!info.displayed) problems.push(`focus lands on a hidden element: ${info.id}`);
        }
        await page.keyboard.press("Tab");
      }

      // Mobile menu: open with Enter, close with Escape, focus returns to the button.
      if (vp.name === "phone" && !p.utility) {
        await page.focus(".nav-toggle");
        await page.keyboard.press("Enter");
        const opened = await page.evaluate(() => ({
          expanded: document.querySelector(".nav-toggle").getAttribute("aria-expanded"),
          shown: getComputedStyle(document.getElementById("site-nav")).display !== "none",
        }));
        if (opened.expanded !== "true" || !opened.shown) problems.push(`menu didn't open from the keyboard (${JSON.stringify(opened)})`);
        await page.keyboard.press("Escape");
        const closed = await page.evaluate(() => ({
          expanded: document.querySelector(".nav-toggle").getAttribute("aria-expanded"),
          focus: document.activeElement.className,
        }));
        if (closed.expanded !== "false" || closed.focus !== "nav-toggle") problems.push(`Escape didn't close the menu and return focus (${JSON.stringify(closed)})`);
      }

      if (problems.length) {
        fail(label);
        problems.forEach((x) => console.error(`    ${x}`));
      } else {
        console.log(`✓ ${label}: skip link first, ${seen.size} focus stops all visibly focused${vp.name === "phone" && !p.utility ? ", menu opens/closes by keyboard" : ""}`);
      }
      await page.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}

const failed = summary.filter((s) => !s.passes).length;
console.log(`\n${summary.length - failed}/${summary.length} page-viewport-theme combinations passed axe, overflow and error checks.`);
