# Prince Kwarteng Amaning: portfolio website

A static professional portfolio: plain HTML, CSS and one small JavaScript file. There's no build step, no framework and no third-party requests at runtime. Fonts are self-hosted and there are no analytics.

**Status:** published at `https://dexteramaning.github.io/` through a manually triggered GitHub Pages workflow. Subsequent changes require the repository checks, owner approvals, and a fresh successful local `npm run preflight` before deployment. The owner's private decision records remain outside this repository.

## Layout

```
site/                     the published root (served by GitHub Pages)
  index.html              home: projects, approach, about, education, skills, contact
  projects/*.html         one case-study page per project (5)
  404.html, robots.txt, sitemap.xml, .nojekyll
  assets/css/styles.css   all styles; navy-and-teal tokens with light and dark themes
  assets/js/main.js       menu toggle, table-of-contents highlight, chart tooltips
  assets/fonts/           Inter and Source Serif 4 (SIL OFL 1.1, licences included)
  assets/img/             favicon, social preview image, notebook figures
sources/                  README snapshots of the four public repos at their published commits
content/claims.json       key wording and whole-number claims, each mapped to a source line
content/owner-approved.json  statements approved by the owner (degree status, profile links, NKABOM access)
site.config.json          site URL and the pinned commit and SHA-256 of each source
scripts/                  checks, local server, screenshots, preflight stamp
docs/                     audit, traceability matrix, deployment checklist, Lighthouse summary
preflight-stamp.json      fingerprint written by a successful local `npm run preflight`
.github/workflows/        checks.yml (checks only) and pages.yml (manual deploy, gated)
COPYRIGHT.md              copyright notice and third-party licences
```

`docs/screenshots/` is generated locally for review and is git-ignored, because it shows approval placeholders.

## Commands

```bash
npm ci                     # install the pinned dev tools (Node 20 or later)
npm run serve              # preview at http://127.0.0.1:4173/
npm run check              # HTML, CSS, links, content traceability, privacy, accessibility
npm run check:perf         # Lighthouse, mobile and desktop, every page
npm run check:approvals    # list content awaiting the owner's approval
npm run traceability       # regenerate docs/TRACEABILITY.md
npm run screenshots        # regenerate docs/screenshots (local only) and the social preview image
npm run predeploy          # all checks, then fail if anything awaits approval (also run by CI)
npm run preflight          # FINAL LOCAL GATE: traceability, predeploy, required private-term
                           # scan, then writes preflight-stamp.json
npm run check:stamp        # verify preflight-stamp.json matches the files (CI enforces this)
node scripts/check-links.mjs --external   # also request every external URL
```

The browser checks use a local Chrome or Edge. Set `CHROME_PATH` if neither is found.

## Publication safeguards

- **Traceability:** every decimal and percentage on the site must appear in the README snapshot of the matching repository. `check:content` fails on any number it can't trace. To change a figure, update the source repository first, refresh the snapshot in `sources/` and its SHA-256 in `site.config.json`, then edit the page.
- **Owner approval:** statements that don't come from a README must match `content/owner-approved.json` exactly. Any LinkedIn URL not listed there fails. Content awaiting approval is wrapped in `data-approval="pending"`. It's visible in local previews and blocks deployment, as does `siteUrlConfirmed: false`.
- **NKABOM:** its page may show no metrics, no large figures and no ML terms (in text, metadata, alt text or tooltips), and may not link to any repository.
- **Privacy:** `check:private` fails if any publishable file contains an email address or an owner decision log. Locally it also scans for the owner's private term list, kept outside the repository (`../portfolio-private/private-terms.txt`). `npm run preflight` **requires** that list and fails without it.
- **Binding CI to the local preflight:** GitHub CI can't see the private list. A successful `npm run preflight` therefore writes `preflight-stamp.json`, a SHA-256 fingerprint of every publishable file. The Pages workflow re-computes it and refuses to deploy if anything changed since the preflight.

## Copyright

See [`COPYRIGHT.md`](COPYRIGHT.md). Original site content: © 2026 Prince Kwarteng Amaning, all rights reserved. Fonts and reproduced figures keep their own licences.
