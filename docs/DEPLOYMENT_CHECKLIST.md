# Deployment-readiness checklist

Status as of 2026-10-26 (after the Phase 3D local preparation). ✅ done and verified locally · ⛔ blocked on an owner decision · ⏳ after deployment.

Target URL: `https://dexteramaning.github.io/`, served from a repository named `DexterAmaning.github.io` (not yet created). Owner decision records are kept outside this repository.

## Build and content

| | Item | Evidence |
|---|---|---|
| ✅ | Static site in `site/`, no build step, no runtime third-party requests | `check:a11y` fails on any failed request; fonts self-hosted |
| ✅ | HTML valid (html-validate recommended + a11y presets) | `npm run check:html`: 0 errors |
| ✅ | CSS lint (stylelint-config-standard) | `npm run check:css`: 0 errors |
| ✅ | Internal links, anchors, assets, canonical, sitemap consistent with `siteUrl` | `npm run check:links`: 198 references, 0 broken |
| ✅ | External links resolve | `--external`: 20/21 HTTP 200; LinkedIn returns 999 to automated requests and must be checked by hand |
| ✅ | Every number traced to a README at the published commit | `npm run check:content`: 158 numbers; see [TRACEABILITY.md](TRACEABILITY.md) |
| ✅ | Owner-approved statements published exactly as approved (MS status, profile links, NKABOM access) | `content/owner-approved.json`, enforced by `check:content` |
| ✅ | No unverified employment titles, dates or degree details | Experience and prior-degree placeholders removed; Education shows the approved MS statement and the README-sourced "Background in dentistry and public health" |
| ✅ | Limitations and the lack of clinical validation on every project page | enforced by `check:content` |
| ✅ | NKABOM: research prototype under active development, repository private, v2 unreleased; no metrics, ML terms, large figures or repository links | enforced by `check:content` (body, metadata, alt text, tooltips) |
| ✅ | No email addresses, phone numbers, local paths, decision logs or private terms in publishable files | `npm run check:private` |
| ✅ | Final preflight fails without the private term list | `npm run preflight` uses `check-private --require-terms` |
| ✅ | Deployment bound to a passing local preflight | `preflight-stamp.json`, verified by the Pages workflow |
| ✅ | Copyright notice for original content | `COPYRIGHT.md`; footer "© 2026 Prince Kwarteng Amaning. All rights reserved." |
| ✅ | Internal review screenshots excluded from the repository | `docs/screenshots/` git-ignored; earlier sets are archived, never overwritten |
| ✅ | Checks proven to fail on injected defects | 23 mutation tests (phases 2 and 3B) plus 8 preflight and stamp scenarios (phase 3D) |
| ⛔ | No content awaiting approval | `npm run check:approvals`: 1 item (`siteUrl` confirmation) |

## Accessibility, SEO and performance

| | Item | Evidence |
|---|---|---|
| ✅ | axe-core WCAG 2.2 A/AA + best practice: 0 violations | 28/28 (7 pages × 2 widths × 2 themes) |
| ✅ | Keyboard: skip link first, visible focus on every stop, menu by keyboard and Escape | 14/14 runs |
| ✅ | No horizontal scroll at 375px | `check:a11y` |
| ✅ | Lighthouse 100 performance, accessibility, best practices and SEO | 12/12 runs (6 pages × mobile and desktop) |
| ✅ | Titles, descriptions, canonical, Open Graph, sitemap, robots, JSON-LD Person (GitHub and LinkedIn) | all use `https://dexteramaning.github.io/` |

## GitHub Pages configuration (prepared, not active)

| | Item | Notes |
|---|---|---|
| ✅ | `.github/workflows/pages.yml`: manual trigger only; runs `npm run predeploy` then `npm run check:stamp`; actions pinned by commit SHA; least-privilege permissions | Fails while approvals are pending or the stamp is missing or stale |
| ✅ | `.github/workflows/checks.yml`: checks on push and PR, `contents: read` only | Deploys nothing; private-term scan is generic only in CI; reports stamp status |
| ✅ | `.gitattributes` stores text as LF | The stamp also normalises line endings |
| ✅ | `.nojekyll`, `404.html` (root paths, suited to a user site), `robots.txt`, `sitemap.xml`; no `CNAME` | |
| ⛔ | Repository `DexterAmaning.github.io` created | Not authorised |
| ⛔ | `siteUrlConfirmed: true` | Only after the repository exists and you approve |
| ⛔ | First commit and push; Settings → Pages → Source: GitHub Actions; manual deploy | Not authorised |

## Launch sequence (each step needs your authorisation)

1. Optional: merge the four project review branches, then refresh `sources/`, the SHA-256s and commit links.
2. Create the public repository `DexterAmaning.github.io` (empty, no README or licence template).
3. Set `"siteUrlConfirmed": true` in `site.config.json`.
4. Run `npm ci`, then `npm run preflight` on the owner's machine. It must end with "preflight stamp written".
5. Review `git status --porcelain --ignored` and `git ls-files -co --exclude-standard` against the first-commit manifest.
6. `git add -A`, then make the first commit (including `preflight-stamp.json`). Add the remote and push `main`.
7. Confirm the "Site checks" workflow passes on GitHub.
8. Settings → Pages → Source: GitHub Actions.
9. Run "Deploy to GitHub Pages" by hand.
10. Any later change: re-run `npm run preflight`, commit the new stamp, push, deploy.

## After deployment

| | Item |
|---|---|
| ⏳ | Re-run `check-links.mjs --external` and Lighthouse against the live URL |
| ⏳ | Confirm HTTPS and that an unknown path serves `404.html` |
| ⏳ | Check the LinkedIn link by hand |
| ⏳ | Update the CV, LinkedIn and GitHub profile website field to the live URL |
