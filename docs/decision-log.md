# Decision Log — AI Silicon / Roofline Lab

**Refresh status:** English simulator-first release, October 4, 2026.

| ID | Decision | Rationale | Verification |
|---|---|---|---|
| D-01 | Strict TypeScript + Vite, no UI framework. | Static one-page app; keep runtime and bundle small. | Type-check and production build. |
| D-02 | No backend, authentication, API, secret, or `.env`. | Self-contained public Pages demo. | Runtime network E2E. |
| D-03 | SVG chart + accessible table; Canvas animation suspended offscreen. | SVG suits eight lines; bounded Canvas loop suits data-flow particles. | Keyboard, reduced motion, visibility, offscreen and frame tests. |
| D-04 | One shared, adjustable compute ceiling for the Roofline chart. | Public peaks use incompatible precision/sparsity/system scopes. The chart isolates bandwidth instead of inventing a leaderboard. | Visible normalization caveat and profile-specific source facts. |
| D-05 | Provenance, units, memory level, scope, and evidence label for each numeric profile field. | Avoid conflating chip/system, precision, claim, derivation, and measurement. | Data fixture tests and source disclosures. |
| D-06 | Eight reference profiles: M4 Max, M5 Pro, M5 Max, Core Ultra 9 285K/Lion Cove, Ryzen 9 9950X/Zen 5, B200, TPU v6e, Groq LPU. | Covers the architectures in the brief. Intel bandwidth remains derived. | Links and qualifications in `research.md`. |
| D-07 | Select all eight profiles by default; use independent include/exclude controls and keep results visible. | The product must compare chips together, not funnel users through one active chip. | E2E default-eight and independent-toggle tests. |
| D-08 | Keep data-path focus separate from chart inclusion. | Users can inspect one architecture without losing the multi-chip comparison. | E2E focus does not alter selected series/rows. |
| D-09 | Simulator first, compact header, responsive comparison workspace, English-only copy. | Remove the long scroll-to-demo path and deliver the requested language. | First viewport at 1280×800; English content audit. |
| D-10 | Test built static output with Playwright; deploy via Node 24 GitHub Actions/Pages. | Verifies real relative assets and no backend; avoid deprecated Node 20 action runtimes. | English refresh passes 21 local tests; remote workflow runs on publish. |
| D-11 | New public repository `macel94/ai-roofline-lab`. | Free Pages and isolation from all existing repositories. | Remote points only to the new repo; the initial site is live and the English refresh will redeploy there. |

## Parallel reviews

Three independent, read-only Pi reviews ran in parallel via tmux sessions before the initial docs and again for the English/UX refresh:

- Product/spec review: INVEST, EARS, multi-chip state, empty/focus cases.
- Roofline/model review: intensity, precision, capacity, memory levels, source caveats.
- UX/visual/English review: first viewport, multi-select/focus separation, instrument design, en-US terminology, accessibility, and performance.

No reviewer wrote application code. Recommendations were incorporated into the docs before the corresponding implementation changes.
