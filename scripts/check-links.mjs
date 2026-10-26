// Link and asset checks. Offline by default; --external also requests every external URL.
//  - every internal href/src (and CSS url()) resolves to a file in site/;
//  - every #fragment exists as an id in the target page;
//  - canonical and og:url match site.config.json; the sitemap lists every page.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { PAGES, SITE, config, fail } from "./lib.mjs";

const external = process.argv.includes("--external");
const files = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? files(join(dir, d.name)) : [join(dir, d.name)]));
const all = files(SITE);
const htmlFiles = all.filter((f) => f.endsWith(".html"));
const ids = new Map(htmlFiles.map((f) => [f, new Set([...readFileSync(f, "utf8").matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]))]));

let internal = 0;
const externals = new Map();

function checkRef(from, ref, kind) {
  if (/^(mailto:|tel:|data:|javascript:)/i.test(ref)) {
    if (/^javascript:/i.test(ref)) fail(`${rel(from)}: javascript: URL`);
    return;
  }
  if (ref.startsWith(config.siteUrl)) {
    // Absolute URL on this site (canonical, og:image): must map to a local file.
    ref = "/" + ref.slice(config.siteUrl.length);
  } else if (/^https?:\/\//i.test(ref)) {
    if (!externals.has(ref)) externals.set(ref, new Set());
    externals.get(ref).add(rel(from));
    return;
  }
  internal++;
  const [pathPart, frag] = ref.split("#");
  const clean = pathPart.split("?")[0];
  let target = from;
  if (clean) {
    target = clean.startsWith("/") ? join(SITE, clean) : resolve(dirname(from), clean);
    if (existsSync(target) && statSync(target).isDirectory()) target = join(target, "index.html");
  }
  if (!existsSync(target)) return fail(`${rel(from)}: broken ${kind} "${ref}"`);
  if (frag && target.endsWith(".html") && !ids.get(target)?.has(frag)) fail(`${rel(from)}: missing anchor "#${frag}" in ${rel(target)}`);
}

const rel = (f) => relative(SITE, f).replace(/\\/g, "/");

for (const f of htmlFiles) {
  const html = readFileSync(f, "utf8");
  for (const m of html.matchAll(/\s(href|src)="([^"]+)"/g)) checkRef(f, m[2], m[1]);
  for (const m of html.matchAll(/\scontent="(https?:\/\/[^"]+)"/g)) checkRef(f, m[1], "meta URL");
  // Duplicate ids break anchors and ARIA references.
  const list = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  const dupes = list.filter((id, i) => list.indexOf(id) !== i);
  if (dupes.length) fail(`${rel(f)}: duplicate ids ${[...new Set(dupes)].join(", ")}`);
}

for (const f of all.filter((x) => x.endsWith(".css"))) {
  for (const m of readFileSync(f, "utf8").matchAll(/url\("?([^")]+)"?\)/g)) checkRef(f, m[1], "CSS url()");
}

// Canonical URLs and sitemap.
const sitemap = readFileSync(join(SITE, "sitemap.xml"), "utf8");
for (const p of PAGES.filter((p) => !p.utility)) {
  const html = readFileSync(join(SITE, p.path), "utf8");
  const expected = config.siteUrl + (p.path === "index.html" ? "" : p.path);
  const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
  const ogUrl = html.match(/<meta property="og:url" content="([^"]+)"/)?.[1];
  if (canonical !== expected) fail(`${p.path}: canonical is ${canonical}, expected ${expected}`);
  if (ogUrl !== expected) fail(`${p.path}: og:url is ${ogUrl}, expected ${expected}`);
  if (!sitemap.includes(`<loc>${expected}</loc>`)) fail(`sitemap.xml: missing ${expected}`);
}
for (const m of sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)) {
  const path = m[1].replace(config.siteUrl, "") || "index.html";
  if (!existsSync(join(SITE, path))) fail(`sitemap.xml: ${m[1]} has no file`);
}
const robots = readFileSync(join(SITE, "robots.txt"), "utf8");
if (!robots.includes(`Sitemap: ${config.siteUrl}sitemap.xml`)) fail("robots.txt: sitemap URL doesn't match siteUrl");

console.log(`${process.exitCode ? "✗" : "✓"} links: ${internal} internal references checked across ${htmlFiles.length} pages; ${externals.size} unique external URLs`);

if (external) {
  let bad = 0;
  let unverified = 0;
  for (const [url, from] of externals) {
    let status = "error";
    try {
      const res = await fetch(url, { method: "GET", redirect: "follow", signal: AbortSignal.timeout(15000), headers: { "User-Agent": "portfolio-link-check" } });
      status = res.status;
    } catch (e) {
      status = e.name;
    }
    // LinkedIn answers automated requests with its non-standard 999 status, so the
    // profile can't be verified this way. Report it as unverified rather than passing it.
    const botBlocked = status === 999 && /^https:\/\/www\.linkedin\.com\//.test(url);
    const ok = typeof status === "number" && status < 400;
    if (botBlocked) unverified++;
    else if (!ok) bad++;
    console.log(`  ${ok ? "✓" : botBlocked ? "?" : "✗"} ${status} ${url}${botBlocked ? " (LinkedIn blocks automated checks; verify by hand)" : ""}  (${[...from].join(", ")})`);
  }
  if (bad) fail(`${bad} external URL(s) failed`);
  else console.log(`✓ external: ${externals.size - unverified} of ${externals.size} URLs returned a success status${unverified ? `; ${unverified} couldn't be checked automatically` : ""}`);
}
