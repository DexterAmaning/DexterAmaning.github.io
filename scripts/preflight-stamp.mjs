// Binds deployment to a successful local preflight.
//
// --write   (end of `npm run preflight`, after every check including the private term
//            scan has passed) records a SHA-256 fingerprint of every file git would publish.
// --verify  (in the Pages workflow) recomputes the fingerprint and fails if the stamp is
//            missing or the content differs, so CI can only deploy exactly what passed the
//            local private scan, which CI itself can't run.
//
// Text files are hashed with line endings normalised to LF, so Windows and Linux agree.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";
import { ROOT, fail } from "./lib.mjs";

const STAMP = "preflight-stamp.json";
const BINARY = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".woff", ".woff2", ".ico", ".pdf"]);

function fingerprint() {
  const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { cwd: ROOT, encoding: "utf8" })
    .split("\n")
    .filter((f) => f && f !== STAMP)
    .sort();
  const all = createHash("sha256");
  for (const f of files) {
    let data = readFileSync(join(ROOT, f));
    if (!BINARY.has(extname(f).toLowerCase())) data = Buffer.from(data.toString("utf8").replace(/\r\n/g, "\n"));
    all.update(`${f}\0${createHash("sha256").update(data).digest("hex")}\n`);
  }
  return { files: files.length, sha256: all.digest("hex") };
}

const current = fingerprint();

if (process.argv.includes("--write")) {
  writeFileSync(join(ROOT, STAMP), JSON.stringify({
    note: "Written by `npm run preflight` after all checks passed, including the required local private-term scan. The Pages workflow refuses to deploy if the published files no longer match.",
    created: new Date().toISOString(),
    files: current.files,
    sha256: current.sha256,
  }, null, 2) + "\n");
  console.log(`✓ preflight stamp written: ${current.files} files, ${current.sha256.slice(0, 16)}...`);
} else {
  const path = join(ROOT, STAMP);
  if (!existsSync(path)) {
    fail(`${STAMP} is missing: run \`npm run preflight\` locally and commit the stamp before deploying`);
  } else {
    const stamp = JSON.parse(readFileSync(path, "utf8"));
    if (stamp.sha256 !== current.sha256 || stamp.files !== current.files) {
      fail(`${STAMP} doesn't match the current files (stamp ${stamp.files} files ${stamp.sha256.slice(0, 16)}..., now ${current.files} files ${current.sha256.slice(0, 16)}...). Re-run \`npm run preflight\` locally.`);
    } else {
      console.log(`✓ preflight stamp matches: ${current.files} files, created ${stamp.created}`);
    }
  }
}
