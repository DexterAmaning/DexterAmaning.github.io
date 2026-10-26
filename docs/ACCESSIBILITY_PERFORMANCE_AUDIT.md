# Accessibility and performance audit

**Run:** 2026-10-26, locally, headless Chrome (system install) via puppeteer-core 25.13.0, axe-core 4.13.0, Lighthouse 13.5.0, html-validate 11.16.2, stylelint 17.15.0. Re-run in full after the Phase 3B corrections, with identical results.
**Scope:** all 7 pages (home, 5 project pages, 404).

## Results

| Check | Result |
|---|---|
| HTML validation (html-validate recommended + a11y presets) | 0 errors |
| CSS lint (stylelint-config-standard) | 0 errors |
| axe-core, WCAG 2.0/2.1/2.2 A and AA plus best practice | **0 violations** in 28/28 runs (7 pages × 375px and 1280px × light and dark) |
| Horizontal overflow at 375px | none on any page |
| Console errors, failed requests | none |
| Keyboard: first Tab stop is a visible skip link | 14/14 runs |
| Keyboard: every focus stop shows a ≥2px focus outline | 14/14 runs (4 to 30 stops per page) |
| Mobile menu: opens with Enter, closes with Escape, focus returns to the button | 6/6 pages with a menu |
| Lighthouse mobile (simulated throttling) | 100 / 100 / 100 / 100 (performance / accessibility / best practices / SEO) on all 6 content pages; LCP 1.7–1.8 s; CLS 0 |
| Lighthouse desktop | 100 / 100 / 100 / 100 on all 6 content pages; LCP 0.4 s; CLS 0 |
| Page weight | 137–146 KiB on first view (mobile), up to 217 KiB with lazy notebook figures (desktop) |

Raw Lighthouse numbers: [`lighthouse/summary.json`](lighthouse/summary.json).

### Items axe marked "needs review"

All were `color-contrast` on text over a gradient (hero bands) or over the 1px chart gridlines, where axe can't compute a single background. I computed the worst case for each pairing against the lightest point of each gradient:

| Text | Worst-case background | Ratio |
|---|---|---|
| Hero lead text, light theme | `#0e4a67` (teal glow at full strength) | 6.12:1 |
| Hero eyebrow, light theme | `#0e4a67` | 5.65:1 |
| Hero lead text, dark theme | `#0d435a` | 5.96:1 |
| Project-hero fact labels | `#13315c` | 8.23:1 |
| Chart labels (secondary ink), light and dark | chart surface | 10.04:1 and 10.63:1 |
| Links (teal) on page background, light theme | `#f5f7fa` | 5.55:1 |

Every pairing meets WCAG AA (4.5:1). The lowest is 5.55:1.

### Lighthouse items below 0.9 (non-scoring)

- `bf-cache`, `document-latency-insight`: caused by the local test server, which sends `Cache-Control: no-store` and no compression. GitHub Pages serves gzip and cacheable responses.
- `unminified-css`, `unused-css-rules`: one 24 KB stylesheet shared by all pages. Minifying would need a build step, which the brief rules out. The saving is a few KB.
- `render-blocking-insight`, `network-dependency-tree-insight`: the stylesheet and two preloaded fonts. That's deliberate, to avoid a flash of unstyled text.
- `image-delivery-insight` (desktop): notebook figures are PNGs copied unchanged from the repositories. WebP versions would save about 50%, at the cost of no longer being byte-identical to the published figures.

## Design decisions behind the results

- **Charts are HTML, not SVG or canvas.** Marks are positioned with CSS custom properties, so labels stay real text at every width. Each plot is `aria-hidden`, has a written caption, and is paired with a data table that screen readers and keyboard users read instead. Hover tooltips are an extra for pointer users only.
- **Chart colours** (teal `#008c84` / orange `#e4622d` light; `#1fa49c` / `#e2672f` dark) passed a colour-vision validator. The checks were lightness band, chroma, CVD separation (ΔE 11.1 light, 14.9 dark), normal-vision separation and 3:1 contrast against the surface. Two-series charts also have a legend and direct labels, so identity never depends on colour alone.
- **Notebook figures** keep their light background in dark mode, on a framed white card. Each has descriptive alt text that I wrote after viewing the image.
- **Respects user settings:** `prefers-color-scheme`, `prefers-reduced-motion` (no smooth scroll or hover lift) and `forced-colors` (borders restored).
- **Tables** scroll inside a labelled, focusable region on narrow screens. The page itself never scrolls sideways.
- **No third parties at runtime:** fonts are self-hosted, with no analytics, CDNs or embeds. The only external links are to GitHub and DOI pages.

## Proving the checks work (mutation tests)

Each defect was injected into a scratch copy of the site, then the relevant check was run.

| Injected defect | Caught by | Result |
|---|---|---|
| Heart ROC-AUC changed 0.907 → 0.917 | check:content | caught |
| Invented "98% accuracy" on the home page | check:content | caught |
| "It uses XGBoost" on the NKABOM page | check:content | caught |
| A "92%" metric on the NKABOM page | check:content | caught |
| "This model is clinically validated" | check:content | caught |
| Limitations section removed | check:content | caught |
| Email address published | check:content | caught |
| Link to the private NKABOM repository | check:content | caught |
| Broken internal link | check:links | caught |
| Broken in-page anchor | check:links | caught |
| Image alt text removed | check:html | caught |
| Low-contrast text via the stylesheet | check:a11y (axe, 1.47:1) | caught |
| Pending approval items present | check:approvals --strict | blocks deploy (4 items after Phase 3B) |

Added in Phase 3B, after the privacy and owner-approval safeguards:

| Injected defect | Caught by | Result |
|---|---|---|
| An unverified four-digit cohort size on the NKABOM page | check:content | caught |
| Link to any repository from the NKABOM page | check:content | caught |
| "XGBoost" in the NKABOM body | check:content | caught |
| "XGBoost" in the NKABOM meta description | check:content | caught (after the scan was extended to metadata) |
| A metric in the NKABOM `og:title` | check:content | caught |
| Owner-approved MS statement altered | check:content | caught |
| Unapproved LinkedIn URL | check:content | caught |
| Private term in a page | check:private | caught |
| Decision log added to the repository | check:private | caught |
| Email address in a docs file (CI mode, no private list) | check:private | caught |
| Unmutated control | all | passes |

## Not covered by automation

- Testing with a real screen reader (NVDA, VoiceOver) and on real phones. I recommend a 15-minute pass before launch.
- Browsers other than Chromium. The CSS uses widely supported features (`:has()`, `color-mix()`, media-query ranges); in older browsers they degrade to plain styling.
- Content judgement. The checks prove numbers match their sources, not that the prose interpretation is right. Each page's wording was written from its README, and you should read every page before approving.
