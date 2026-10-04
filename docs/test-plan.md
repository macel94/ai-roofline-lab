# Test and Deployment Plan — AI Silicon / Roofline Lab

**Physical-map baseline:** October 4, 2026. Tests run against the built static site, without authentication, backend, runtime API, or remote asset service.

## 1. Strategy

| Level | Purpose | Tool/path |
|---|---|---|
| Type check | Application/test types and DOM APIs | Strict TypeScript `tsc --noEmit` |
| Domain tests | Weight bytes, matrix work, stream/reference times, fit, bottleneck boundaries | Pure model functions imported by Playwright tests |
| E2E | English map, physical path, all-profile comparison, workload shifts, no auth | Playwright Chromium against `vite preview` serving `dist/` |
| Accessibility | Semantics, keyboard, reduced motion, viewport | Playwright locators/assertions plus manual WCAG 2.2 AA review |
| Static build | Local assets, relative base path, output size | `vite build`, inspect `dist`, preview server, `curl` |
| Motion | Pause/resume, reduced motion, hidden/offscreen suspension | CSS animation state and `IntersectionObserver` assertions; no application RAF loop |
| Live Pages | Deployment and real public URL | GitHub Actions result, HTTP/asset checks, remote browser smoke |

Tests use versioned local profile data. No API key, login, remote storage, or external test service is required.

## 2. Domain/model test matrix

1. Decimal units: GB, GB/s, FLOP/byte; 1 TB/s = 1,000 GB/s.
2. Weight memory: 7B Q4 = 3.5 GB raw; Q8 = 7 GB; 16-bit = 14 GB.
3. Fit reserve: 7B Q4 × 1.20 = 4.2 GB; 70B Q4 × 1.20 = 42 GB.
4. Decode intensity: 7B Q4, batch 1, K=1 gives 4 FLOP/byte; batch 8 gives 32.
5. Prefill intensity: 7B Q4, batch 1, K=512 gives 2,048 FLOP/byte.
6. Memory roof: BW=1,000 GB/s, I=4 gives 4 TFLOP/s.
7. Roofline minimum and ridge point with `P_ref=1,000 TFLOP/s`.
8. Ideal data time: 3.5 GB / 614 GB/s × 1,000 = 5.7003 ms.
9. Reference matrix time: 14 GFLOP / 1,000 TFLOP/s = 0.014 ms; 7,168 GFLOP gives 7.168 ms.
10. Bottleneck boundaries: data-feed limited below 95% reference compute; matrix-work limited above 105%; balanced within ±5%.
11. Invalid values: q=0, batch=0, negative model size, NaN, infinity, empty and overflow do not yield bogus calculations/fit.
12. Unknown values: missing bandwidth/capacity are `Unknown`, never zero or implicit fit.
13. Data fixtures: Apple facts, derived DDR bandwidths, per-GPU DGX values, TPU-per-chip values, and Groq lower-bound claim match `research.md`.

## 3. Playwright E2E — static production build

### First screen and physical explanation

- `npm run test:e2e` builds `dist/` before launching `vite preview`.
- Page title, language, visible copy, accessible names, errors, and documentation are English (en-US).
- At 1280×800, the visitor sees the Decode/Prefill switch, workload bytes and operations, the live “why” explanation, and the start of the shared 2D map before the detailed workload form or Roofline disclosure.
- The shared map renders exactly eight aligned hardware lanes; all eight are included on first load.
- Each path explicitly identifies a memory tier, data rate, engine, capacity/fit, bottleneck stage, per-chip compute fact/evidence, source link, and the two modeled stage times where included.
- Workload receipt for the default 7B Q4 Decode case is 3.5 GB, 14 GFLOP, and 4 FLOP/byte; the shared 1,000 TFLOP/s reference gives 0.014 ms matrix work.
- The UI does not require login and has no unhandled JavaScript errors or external runtime requests.

### Shared comparison and “eureka” transition

- Each lane has an accessible include/exclude button; excluded lanes stay visible but are dimmed. Inclusion updates the insight and optional Roofline/table without changing other profiles.
- “Select all,” “Clear all,” and reset perform their documented behavior. Zero selected profiles has an explicit explanation and restore action.
- Decode defaults to low reuse and data-feed bottlenecks. At the default Q4/512-token Prefill case, expected classification is 3 data-feed limited and 5 matrix-work limited at the shared reference rate.
- Model size, weight bits, batch, context, shared reference rate, and host RAM update workload quantities, stream/reference times, fit, and bottleneck state.
- Verify fit/does-not-fit/unknown, including 70B Q4 against one 32 GB TPU v6e chip and unknown Groq capacity.
- Profile-specific compute facts retain precision and scope: for example B200 FP4 dense and TPU v6e BF16/INT8 are displayed separately, not ranked as interchangeable peaks. Quantized weight bits do not imply arithmetic precision.
- Source links open only on user action; there are no automatic source fetches.

### Responsive/accessibility/motion

- Keyboard reaches/toggles each chip lane, changes phase and all ranges, and opens technical/source disclosures; focus is visible and survives lane updates.
- Color is paired with labels, numbers, and “Data feed”/“Matrix work” text states.
- `prefers-reduced-motion: reduce` pauses flow motion while all calculations and controls continue to work.
- A visible Pause/Resume control works. Motion pauses when the meaningful map area is outside the viewport or the document is hidden. The hidden-document E2E assertion overrides `visibilityState` and dispatches `visibilitychange` to exercise the handler deterministically; it is not a real background-tab scheduling measurement.
- Desktop (1280×800 / 1600×1000), tablet (768×1024), and mobile (390×844 / 360×800): no page-level horizontal overflow or critical overlap.
- The CSS transform cue is explicitly documented as a log-scaled visual, not literal packet timing. There is no JavaScript animation loop.

### Runtime network

- Fail E2E if the app requests resources from external origins.
- Source links are navigated only after deliberate user action.
- Block non-local requests after initial load and repeat core phase/selection actions; bundled profile data must continue working.

## 4. Motion and bundle budget

- At most one small CSS-transform stream signal per visible chip lane; no per-frame DOM/layout mutation and no application `requestAnimationFrame` loop.
- Use `IntersectionObserver` (with a 100 px safe-viewport inset), document visibility, a user toggle, and `prefers-reduced-motion` to suspend motion.
- Keep the motion target smooth (about 60 fps on a capable reference browser) without asserting an exact frame cadence on a virtualized CI runner.
- Target ≤150 KB gzip JavaScript, ≤30 KB gzip CSS, ≤300 KB local assets; no remote font/image.
- SVG Roofline recalculations occur on input/selection, independently of the CSS flow cue.

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

## 7. Physical-map refresh — local verification

- `npm run test:e2e`: **21/21 passed** (11 domain tests + 10 Chromium E2E tests; strict type-check and production build included).
- `npm audit --audit-level=moderate`: zero vulnerabilities.
- Build: HTML 21.73 KB (6.29 KB gzip), CSS 50.15 KB (10.85 KB gzip), JS 32.03 KB (10.42 KB gzip), favicon SVG 490 B.
- Desktop 1280×800, wide 1600×1000, tablet 768×1024, and mobile 390×844 / 360×800 all have document width equal to viewport width; no browser errors in the local layout probe.
- Default Decode shows eight active physical lanes, 3.5 GB weight traffic, 14 GFLOP matrix work, and the data-feed explanation. Prefill changes work to 7,168 GFLOP at the same weight volume; five lanes hit the matrix-work reference first and three remain data-feed limited.
- Lane-stage-time and capacity assertions, chip compute facts/evidence, keyboard selection, reduced motion, pause/resume, hidden-document handling, offscreen suspension, offline phase changes, and the optional Roofline chart/table all pass.
- Chromium frame-cadence samples at 1440×900 with the map visible: default 301 intervals / 5,016.4 ms = 60.0 fps (median 16.7 ms, p95/max 16.8 ms); maximum 120B/16-bit/batch-32/8,192-token Prefill 287 intervals / 5,016.5 ms = 57.2 fps (median/p95 16.7 ms, maximum 250 ms). The maximum sample starts immediately after changing controls and includes a long interval; this is a reference-browser observation, not a guaranteed animation frame rate or hardware benchmark.
- These stage times are teaching estimates, not measured chip latency or a cost/performance ranking.

## 8. GitHub Pages deployment

- Public repository: [github.com/macel94/ai-roofline-lab](https://github.com/macel94/ai-roofline-lab).
- Published URL: [https://macel94.github.io/ai-roofline-lab/](https://macel94.github.io/ai-roofline-lab/).
- Pages source is GitHub Actions; the workflow uses Node 24 and current official Actions releases.
- The physical-map refresh becomes current on the public URL after its full workflow succeeds.

## 9. Post-deploy checklist

1. Confirm the latest Action run is successful and its SHA matches `main`.
2. Confirm the public URL and all relative assets return HTTP 200 with expected MIME types.
3. Open the live site and try Decode/Prefill, eight lanes, individual toggles, fit states, per-chip compute fact qualifications, and reduced motion.
4. Check browser console/network: no API/auth and no automatic external requests.
5. Confirm only the new `ai-roofline-lab` repository was created or changed.
