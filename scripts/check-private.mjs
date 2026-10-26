// Guards against private material entering the repository that will be made public.
//
// Always (including CI): every file git would publish is scanned for email addresses,
// and owner decision logs (DECISIONS*.md) must not exist inside the project.
//
// With --require-terms (used by `npm run preflight`), a missing or empty list is a failure.
//
// Locally: if the owner's private term list exists outside the repository
// (../portfolio-private/private-terms.txt, or PRIVATE_TERMS), every publishable text
// file is also scanned for those terms. The list itself never enters the repository,
// so it can't leak through this check.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { ROOT, fail } from "./lib.mjs";

const BINARY = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".woff", ".woff2", ".ico", ".pdf"]);
const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { cwd: ROOT, encoding: "utf8" })
  .split("\n")
  .filter(Boolean)
  .filter((f) => !BINARY.has(extname(f).toLowerCase()));

for (const f of files) {
  if (/^decisions.*\.md$/i.test(basename(f))) fail(`${f}: owner decision logs belong outside the repository`);
}

const termsPath = process.env.PRIVATE_TERMS ?? join(ROOT, "..", "portfolio-private", "private-terms.txt");
const terms = existsSync(termsPath)
  ? readFileSync(termsPath, "utf8").split(/\r?\n/).map((t) => t.trim()).filter((t) => t && !t.startsWith("#"))
  : null;
// The final local preflight must never fall back to the generic checks.
if (process.argv.includes("--require-terms") && !terms?.length) {
  fail(`private term list not found or empty at ${termsPath}; the final preflight requires it`);
}
const patterns = (terms ?? []).map((t) => new RegExp(`(?<![\\w])${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w])`, "i"));
const EMAIL = /[\w.+-]+@[\w-]+\.[a-z]{2,}/i;

let scanned = 0;
for (const f of files) {
  const text = readFileSync(join(ROOT, f), "utf8");
  scanned++;
  if (f !== "package-lock.json") {
    const email = text.match(EMAIL);
    if (email) fail(`${f}: contains an email address (${email[0]})`);
    patterns.forEach((re, i) => {
      if (re.test(text)) fail(`${f}: contains private term #${i + 1} from the owner's private list`);
    });
  }
}

const mode = terms ? `${terms.length} private terms checked` : "private term list not present here, so only generic checks ran";
console.log(`${process.exitCode ? "✗" : "✓"} private: ${scanned} publishable text files scanned; ${mode}`);
