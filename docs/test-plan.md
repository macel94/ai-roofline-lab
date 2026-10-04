# Test and Deployment Plan — AI Silicon / Roofline Lab

**Refresh baseline:** October 4, 2026. Tests run against the static production build to verify use without authentication or an API.

## 1. Strategy

| Level | Purpose | Tool/path |
|---|---|---|
| Type check | Application/test types and DOM APIs | Strict TypeScript `tsc --noEmit` |
| Domain tests | Equations, units, fit, bottleneck states | Pure model functions imported by Playwright tests |
| E2E | English UI, all-profile comparison, interaction, no auth | Playwright Chromium against `vite preview` serving `dist/` |
| Accessibility | Semantics, keyboard, reduced motion, viewport | Playwright locators/assertions plus manual WCAG 2.2 AA contrast review |
| Static build | Local assets, relative base path, output size | `vite build`, inspect `dist`, preview server, `curl` |
| Performance | RAF loop, frame intervals, update responsiveness | E2E smoke plus repeatable desktop browser frame sample |
| Live Pages | Deployment and real public URL | GitHub Actions result, HTTP/asset checks, remote browser smoke |

Tests use versioned local profile data. No API key, login, remote storage, or external test service is required.

## 2. Domain/model test matrix

1. Decimal units: GB, GB/s, FLOP/byte; 1 TB/s = 1,000 GB/s.
2. Weight memory: 7B Q4 = 3.5 GB raw; Q8 = 7 GB; 16-bit = 14 GB.
3. Fit reserve: 7B Q4 × 1.20 = 4.2 GB; 70B Q4 × 1.20 = 42 GB.
4. Decode intensity: 7B Q4, batch 1, K=1 gives 4 FLOP/byte; batch 8 gives 32.
5. Prefill intensity: 7B Q4, batch 1, K=512 gives 2,048 FLOP/byte.
6. Memory roof: BW=1,000 GB/s, I=4 gives 4 TFLOP/s.
7. Roofline min: with `P_ref=1,000 TFLOP/s`, test memory-limited and compute-limited sides.
8. Ridge point: `P_ref=1,000`, BW=1,000 gives 1,000 FLOP/byte.
9. Boundary states: memory-bound below 95% compute roof, compute-bound above 105%, balanced within ±5%.
10. Invalid values: q=0, batch=0, negative model size, NaN, infinity, empty and overflow do not yield bogus calculations/fit.
11. Unknown profiles: missing bandwidth/capacity is `Unknown`, never zero or implicit fit.
12. Data fixtures: Apple facts, derived DDR bandwidths, per-GPU DGX values, TPU-per-chip values, and Groq lower-bound claim match `research.md`.

## 3. Playwright E2E — static production build

### First screen and language

- `npm run test:e2e` builds `dist/` before launching `vite preview`.
- Page title, page language, visible copy, labels, tooltips, error states, and accessible names are English (en-US).
- At 1280×800 and 100% zoom, the primary workload controls, all-profile selector, chart, and first comparison summaries are visible or operable without scrolling through an introductory gallery.
- The UI does not require login and has no unhandled JavaScript errors.

### Multi-chip comparison

- Exactly eight profile controls exist.
- On first load, all eight have selected state, all available curves appear, and all eight result rows/cards are visible without opening a collapsed table.
- Each selection toggle adds/removes only its own curve/result and preserves the remaining profile states.
- “Select all,” “Clear all,” and reset-to-default perform the documented behavior.
- With no profiles selected, an explicit empty state and Select all action appear; stale results do not remain.
- Changing a workload input recomputes every included profile from the same input state.
- Focusing one data path changes emphasis/details without removing any comparison curve/result.
- Excluding a focused profile clears or redirects focus but does not silently change other inclusions.

### Workload, values, and sources

- Decode/prefill, model parameter count, q4/q8/16-bit weights, batch, context, compute ceiling, and host RAM update the simulation.
- Verify default values and numeric cases in `model.spec.ts`; validate en-US number grouping (`2,048`, `16,384`).
- Verify memory-bound, compute-bound, balanced, invalid-input, fit, does-not-fit, and unknown states.
- For 70B Q4, 42 GB estimated working set does not fit one 32 GB v6e chip; Groq capacity remains Unknown.
- Profile sources open voluntarily in a new tab and are not fetched automatically.

### Responsive/accessibility

- Keyboard can reach/toggle all profiles, move every range input with arrow keys, use focus/reset, and open disclosures.
- Visible focus ring; English accessible names and selected states; no color-only series encoding.
- `prefers-reduced-motion: reduce` keeps calculations/control state functional and stops the RAF loop when the canvas is in view.
- Desktop (1280×800), tablet (768×1024), mobile (360×800 / 390×844), and 200% zoom: no critical overlap or page-level horizontal overflow.
- Motion loop starts when the flow canvas enters the viewport, stops when it leaves, on hidden tab, pause, or reduced motion, and resumes on return when permitted.
- Resize and repeated selection changes do not leave duplicate observers or animation loops.

### Runtime network

- Fail E2E if the app requests runtime resources from external origins.
- Source links are navigated only on user action.
- Block non-local requests after initial load and repeat core control/compare actions; the bundled profile data continues to work.

## 4. 60 FPS and bundle budget

- One `requestAnimationFrame` loop, delta-time, max 24 particles, no per-frame DOM/layout mutation; suspend when hidden or offscreen.
- E2E wraps RAF and verifies frame progress while active and no progress while reduced-motion, paused, hidden, or offscreen.
- On a reference desktop, target 60 fps (16.7 ms/frame). Record 5-second median and p95 under all profiles and a maximum workload. Do not make an exact-60 CI assertion on a virtualized runner; verify no duplicate loops or input-blocking work.
- Target ≤150 KB gzip JavaScript, ≤30 KB gzip CSS, ≤300 KB local assets; no remote font/image.
- SVG recalculations occur on input/selection/resize, independently of the canvas tick.

## 5. Local commands

```sh
npm ci
npx playwright install chromium   # one-time local browser setup
npm run dev
npm run typecheck
npm run test:e2e
npm run build
npm run preview
```

`test:e2e` runs against `dist/`. `vite preview` is for local verification, not the production server.

## 6. GitHub Actions / Pages

- Trigger on push to `main` and `workflow_dispatch`.
- Node 24 with npm caching and `npm ci`.
- Install Chromium with `npx playwright install --with-deps chromium`, run typecheck/build/E2E, then upload `dist/` and deploy.
- Official current major releases: checkout v7, setup-node v7, configure-pages v6, upload-pages-artifact v5, deploy-pages v5.
- Minimum permissions: `contents: read`, `pages: write`, `id-token: write`; concurrency group `github-pages`.
- Public Free-tier repo: `macel94/ai-roofline-lab`. Do not change or deploy to any other repository.

## 7. English refresh — local verification

- `npm run test:e2e`: **21/21 passed** (11 domain tests + 10 Chromium E2E tests; strict type-check and production build included).
- `npm audit --audit-level=moderate`: zero vulnerabilities.
- Build: HTML 21.48 KB (6.15 KB gzip), CSS 31.93 KB (7.71 KB gzip), JS 29.62 KB (9.53 KB gzip), favicon SVG 490 B.
- At 1280×800, all workload controls and all eight included profile chips are visible; the Roofline plot begins in the initial viewport. At 390×844, document width equals viewport width.
- Initial state: eight selected profiles, eight Roofline curves, and eight visible result rows. Toggling one chip changes only its own curve/result; focus keeps the comparison intact.
- No Italian diacritics or known Italian UI phrases remain in source, tests, docs, or package metadata.
- English palette contrast spot-check: primary text 16.25:1, chart ticks 10.13:1, profile sublabels 9.35:1; chip traces ≥6.34:1 on the plot.
- Chromium headless desktop 1440×900, flow canvas visible, five-second sample: default 300 frames / 5,015 ms, 59.8 fps, median 16.7 ms, p95 16.8 ms, one interval over 20 ms (max 49.9 ms).
- Maximum workload (120B, 16-bit weights, batch 32, prefill 8,192): 302 frames / 5,008 ms, 60.3 fps, median 16.7 ms, p95 16.7 ms, no interval over 20 ms (max 16.8 ms).
- These are local browser samples, not guarantees for every device.

## 8. GitHub Pages deployment

- Public repository: [github.com/macel94/ai-roofline-lab](https://github.com/macel94/ai-roofline-lab).
- Published URL: [https://macel94.github.io/ai-roofline-lab/](https://macel94.github.io/ai-roofline-lab/).
- Pages source is GitHub Actions; the workflow uses Node 24 and current official Actions releases.
- The English refresh is published after the workflow’s full E2E/build job succeeds.

## 9. Post-deploy checklist

1. Confirm the latest Action run is successful and its SHA matches `main`.
2. Confirm the public URL and all relative assets return HTTP 200 with expected MIME types.
3. Open the live site and try decode and prefill, all eight profiles, independent toggles, data-path focus, fit states, and reduced motion.
4. Check browser console/network: no API/auth and no automatic external requests.
5. Confirm only the new `ai-roofline-lab` repository was created or changed.
