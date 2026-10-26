// Lists content awaiting the owner's approval. With --strict (used by predeploy and the
// Pages workflow) any pending item, or an unconfirmed site URL, fails the run.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PAGES, SITE, config } from "./lib.mjs";

const strict = process.argv.includes("--strict");
const pending = [];
for (const p of PAGES) {
  const html = readFileSync(join(SITE, p.path), "utf8");
  for (const m of html.matchAll(/data-approval="pending" data-approval-id="([^"]+)"/g)) pending.push(`${p.path}: ${m[1]}`);
}
if (!config.siteUrlConfirmed) {
  pending.push(`site.config.json: siteUrl ${config.siteUrl} not confirmed (its hosting repository must exist and deployment must be authorised; then set siteUrlConfirmed to true)`);
}

console.log(`${pending.length} item(s) awaiting owner approval:`);
pending.forEach((x) => console.log(`  - ${x}`));
if (strict && pending.length) {
  console.error("✗ Deployment blocked until every item above is approved and resolved.");
  process.exitCode = 1;
}
