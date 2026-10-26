// Shared helpers for the check scripts: page list, a static server and Chrome discovery.
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
export const SITE = join(ROOT, "site");

// Every published page, with the README sources its numbers must come from.
export const PAGES = [
  { path: "index.html", sources: ["heart", "diabetes", "autism", "medicaid"] },
  { path: "projects/heart-disease-risk.html", sources: ["heart"] },
  { path: "projects/medicaid-diabetes-spending.html", sources: ["medicaid"] },
  { path: "projects/autism-aq10-screening.html", sources: ["autism"] },
  { path: "projects/diabetes-risk.html", sources: ["diabetes"] },
  { path: "projects/nkabom.html", sources: [], nkabom: true },
  { path: "404.html", sources: [], utility: true },
];

export const config = JSON.parse(readFileSync(join(ROOT, "site.config.json"), "utf8"));

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
};

// Serves site/ like GitHub Pages: directory index, 404.html for misses.
export function startServer(port = 0) {
  const server = createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    let file = normalize(join(SITE, decodeURIComponent(url.pathname)));
    if (!file.startsWith(SITE + sep) && file !== SITE) {
      res.writeHead(403).end();
      return;
    }
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
    let status = 200;
    if (!existsSync(file)) {
      file = join(SITE, "404.html");
      status = 404;
    }
    res.writeHead(status, {
      "Content-Type": TYPES[extname(file)] ?? "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(readFileSync(file));
  });
  return new Promise((ok) => {
    server.listen(port, "127.0.0.1", () => {
      const { port: actual } = server.address();
      ok({ server, origin: `http://127.0.0.1:${actual}` });
    });
  });
}

export function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ].filter(Boolean);
  const found = candidates.find((p) => existsSync(p));
  if (!found) throw new Error("No Chrome or Edge found. Set CHROME_PATH.");
  return found;
}

export async function launchBrowser() {
  const { default: puppeteer } = await import("puppeteer-core");
  return puppeteer.launch({
    executablePath: findChrome(),
    headless: true,
    args: ["--no-first-run", "--no-default-browser-check", "--font-render-hinting=none"],
  });
}

export function fail(message) {
  console.error(`\u2717 ${message}`);
  process.exitCode = 1;
}
