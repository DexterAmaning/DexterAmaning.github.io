// Content integrity and traceability.
//
// 1. Every README snapshot in sources/ matches its recorded SHA-256.
// 2. Every decimal and percentage a visitor can see (text, alt text, chart
//    tooltips, meta descriptions) appears in an allowed README snapshot.
// 3. Key non-decimal claims in content/claims.json appear on the page and in
//    the source.
// 4. Required disclaimers are present; NKABOM restrictions and privacy rules hold.
//
// --write-matrix also writes docs/TRACEABILITY.md.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PAGES, ROOT, config, fail, launchBrowser, startServer } from "./lib.mjs";

const writeMatrix = process.argv.includes("--write-matrix");

// ---- Sources ----
const sources = {};
for (const [key, meta] of Object.entries(config.sources)) {
  const raw = readFileSync(join(ROOT, meta.file));
  const sha = createHash("sha256").update(raw).digest("hex");
  if (sha !== meta.sha256) fail(`${meta.file}: SHA-256 ${sha} doesn't match the recorded ${meta.sha256}`);
  sources[key] = { ...meta, lines: raw.toString("utf8").split(/\r?\n/) };
}

const TOKEN = /(?<![\d.])\d+\.\d+(?![\d.])%?|(?<![\d.])\d+%/g;

function locate(token, keys) {
  const esc = token.replace(/[.%]/g, (c) => "\\" + c);
  const re = new RegExp(`(?<![\\d.])${esc}(?![\\d])`);
  for (const key of keys) {
    const lines = sources[key].lines;
    for (let i = 0; i < lines.length; i++) {
      if (re.test(lines[i])) return { key, line: i + 1, excerpt: lines[i].trim() };
    }
  }
  return null;
}

// ---- Pages ----
const claims = JSON.parse(readFileSync(join(ROOT, "content/claims.json"), "utf8")).claims;
const ownerApproved = JSON.parse(readFileSync(join(ROOT, "content/owner-approved.json"), "utf8"));
const { server, origin } = await startServer();
const browser = await launchBrowser();
const matrix = [];
let tokenCount = 0;
let claimCount = 0;

try {
  const page = await browser.newPage();
  for (const p of PAGES) {
    await page.goto(`${origin}/${p.path}`, { waitUntil: "load" });
    const data = await page.evaluate(() => {
      // Text-bearing metadata only (not URLs or image dimensions).
      const meta = [...document.querySelectorAll('title, meta[name="description"], meta[property="og:title"], meta[property="og:description"], meta[property="og:image:alt"]')]
        .map((m) => m.content ?? m.textContent)
        .join("\n");
      const alts = [...document.querySelectorAll("img[alt]")].map((i) => i.alt).join("\n");
      const tips = [...document.querySelectorAll("[data-tip]")].map((e) => e.dataset.tip).join("\n");
      // Join text nodes with spaces so adjacent table cells don't run together.
      const textOf = (node) => {
        const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
        const parts = [];
        while (walker.nextNode()) parts.push(walker.currentNode.nodeValue);
        return parts.join(" ").replace(/\s+/g, " ");
      };
      const body = document.body.cloneNode(true);
      body.querySelectorAll('script, style, [data-trace="axis"]').forEach((e) => e.remove());
      const pendingText = [...body.querySelectorAll("[data-approval]")].map(textOf).join("\n");
      const text = textOf(body);
      body.querySelectorAll("[data-approval]").forEach((e) => e.remove());
      const publishedText = textOf(body);
      const html = document.documentElement.outerHTML;
      const limits = document.getElementById("limitations")?.textContent ?? "";
      const repoLinks = [...document.querySelectorAll('a[href^="https://github.com/DexterAmaning/"]')].map((a) => a.href);
      return { meta, alts, tips, text, publishedText, pendingText, html, limits, repoLinks };
    });

    const visible = [data.text, data.alts, data.tips, data.meta].join("\n");

    // 2. Numbers
    const tokens = [...new Set(visible.match(TOKEN) ?? [])];
    if (p.nkabom && tokens.length) {
      fail(`${p.path}: NKABOM page must show no metrics, but contains ${tokens.join(", ")}`);
    }
    for (const t of tokens) {
      if (p.nkabom || p.utility) continue;
      tokenCount++;
      const hit = locate(t, p.sources);
      if (!hit) fail(`${p.path}: "${t}" isn't in any allowed source (${p.sources.join(", ")})`);
      else matrix.push({ page: p.path, kind: "number", value: t, ...hit });
    }

    // 3. Claims
    for (const c of claims.filter((c) => c.page === p.path)) {
      claimCount++;
      if (!data.publishedText.includes(c.text)) fail(`${p.path}: claim text not found on page: "${c.text}"`);
      const src = sources[c.source];
      const idx = src.lines.findIndex((l) => l.includes(c.sourceText));
      if (idx < 0) fail(`${p.path}: claim source text not in ${src.file}: "${c.sourceText}"`);
      else matrix.push({ page: p.path, kind: "claim", value: c.text, key: c.source, line: idx + 1, excerpt: src.lines[idx].trim() });
    }

    // 4. Disclaimers and restrictions
    const lower = data.publishedText.toLowerCase();
    if (!p.utility) {
      if (!lower.includes("research and education only")) fail(`${p.path}: missing the research-and-education-only notice`);
      for (const m of lower.matchAll(/clinically validated/g)) {
        const before = lower.slice(Math.max(0, m.index - 60), m.index);
        if (!/\b(not|no|never|isn't|hasn't|without)\b/.test(before)) {
          fail(`${p.path}: "clinically validated" without a negation: "...${before}clinically validated"`);
        }
      }
    }
    if (p.path.startsWith("projects/")) {
      if (!data.limits) fail(`${p.path}: no #limitations section`);
      if (p.path !== "projects/medicaid-diabetes-spending.html" && !/not clinically validated/i.test(data.limits)) {
        fail(`${p.path}: limitations don't state the lack of clinical validation`);
      }
      if (!p.nkabom) {
        const repo = config.sources[p.sources[0]].repo;
        if (!data.repoLinks.some((h) => h.startsWith(`https://github.com/${repo}`))) fail(`${p.path}: no link to ${repo}`);
        if (!data.html.includes('id="reproduce"')) fail(`${p.path}: no reproducibility section`);
      }
    }
    if (p.nkabom) {
      for (const phrase of ["synthetic-data oral-systemic health research prototype", "synthetic data only", "not clinically validated", "not a diagnostic system"]) {
        if (!lower.includes(phrase)) fail(`${p.path}: required phrase missing: "${phrase}"`);
      }
      // Model metrics and ML methods don't belong on a rule-based, synthetic-data prototype page.
      const banned = ["xgboost", "shap", "roc-auc", "auc", "accuracy", "sensitivity", "specificity", "precision", "recall", "f1", "neural", "deep learning"];
      // Scan everything a visitor or search engine sees: body, metadata, alt text, tooltips.
      const published = [data.publishedText, data.meta, data.alts, data.tips].join("\n");
      for (const b of banned) {
        if (new RegExp(`\\b${b.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&")}\\b`, "i").test(published)) {
          fail(`${p.path}: banned term on the NKABOM page: "${b}"`);
        }
      }
      // No cohort sizes, counts or other large figures (years excepted).
      const big = published.match(/\b\d{1,3}(?:,\d{3})+\b|\b(?!(?:19|20)\d{2}\b)\d{3,}\b/);
      if (big) fail(`${p.path}: unverified figure on the NKABOM page: "${big[0]}"`);
      // The only GitHub link allowed is the public profile; the NKABOM repository is private.
      const repoLink = data.html.match(/https:\/\/github\.com\/DexterAmaning\/[\w.-]+/i);
      if (repoLink) fail(`${p.path}: links to a repository (${repoLink[0]}); NKABOM's repository is private`);
    }

    // Owner-approved statements (not from a README) must appear exactly as approved.
    for (const s of ownerApproved.statements.filter((s) => s.page === p.path)) {
      claimCount++;
      if (!data.publishedText.includes(s.text)) fail(`${p.path}: owner-approved statement missing or altered: "${s.text}"`);
      else matrix.push({ page: p.path, kind: "owner-approved", value: s.text, owner: s.approved });
    }

    // Only approved external profile links.
    for (const m of data.html.matchAll(/https?:\/\/(?:[\w-]+\.)?linkedin\.com\/[^"'\s<]*/gi)) {
      if (!ownerApproved.profiles.includes(m[0])) fail(`${p.path}: unapproved LinkedIn URL ${m[0]}`);
    }

    // Privacy: no email addresses, phone numbers or local paths anywhere in the HTML.
    if (/[\w.+-]+@[\w-]+\.[\w.]+/.test(data.publishedText)) fail(`${p.path}: contains an email address`);
    const phone = data.publishedText.match(/(?<![\d.])(?:\+\d{1,3}[ -]?)?\(?\d{3}\)?[ -]\d{3}[ -]\d{4}(?![\d.])/);
    if (phone) fail(`${p.path}: possible phone number: "${phone[0]}"`);
    if (/[A-Z]:\\Users|\/Users\/|localhost|127\.0\.0\.1/i.test(readFileSync(join(ROOT, "site", p.path), "utf8"))) {
      fail(`${p.path}: contains a local path or localhost reference`);
    }
  }
} finally {
  await browser.close();
  server.close();
}

if (writeMatrix) {
  const rows = matrix.map((m) => {
    if (m.kind === "owner-approved") return `| \`${m.page}\` | owner-approved | ${m.value} | Approved by the owner, ${m.owner} | n/a |`;
    const src = sources[m.key];
    const link = `https://github.com/${src.repo}/blob/${src.commit}/README.md#L${m.line}`;
    const ex = m.excerpt.length > 110 ? m.excerpt.slice(0, 107) + "..." : m.excerpt;
    return `| \`${m.page}\` | ${m.kind} | \`${m.value}\` | [${src.repo.split("/")[1]} README L${m.line}](${link}) | ${ex.replace(/\|/g, "\\|")} |`;
  });
  const md = [
    "# Verified-content traceability matrix",
    "",
    "Generated by `npm run traceability` (scripts/check-content.mjs). Do not edit by hand.",
    "",
    "Every decimal and percentage a visitor can see (body text, chart labels and tooltips, alt text, meta descriptions) is matched",
    "against a snapshot of the project README at the commit currently published on GitHub `main`. Snapshots live in `sources/`",
    "and are pinned by SHA-256 in `site.config.json`. Key whole-number and wording claims are listed in `content/claims.json`.",
    "Chart axis tick labels are excluded because they are scale markings, not findings.",
    "",
    "| Source | Commit |",
    "|---|---|",
    ...Object.values(config.sources).map((s) => `| ${s.repo} | \`${s.commit.slice(0, 7)}\` |`),
    "",
    "The NKABOM page is checked differently: it may show no metrics at all, and banned terms (model metrics, ML methods, unverified cohort sizes, the private repository name) fail the build.",
    "",
    "Statements that come from the owner rather than a README (for example, degree status) are listed in `content/owner-approved.json` with their approval date and must appear exactly as approved.",
    "",
    `**${matrix.length} traced items** (${tokenCount} numeric occurrences across pages, ${claimCount} claims and owner-approved statements).`,
    "",
    "| Page | Kind | Value on site | Source (file and line) | Source line |",
    "|---|---|---|---|---|",
    ...rows,
    "",
  ].join("\n");
  writeFileSync(join(ROOT, "docs/TRACEABILITY.md"), md);
  console.log("Wrote docs/TRACEABILITY.md");
}

if (!process.exitCode) console.log(`✓ content: ${tokenCount} numbers and ${claimCount} claims traced to README sources; disclaimers and restrictions hold`);
