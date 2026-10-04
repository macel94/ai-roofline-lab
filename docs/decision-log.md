# Decision Log — AI Silicon / Roofline Lab

**Refresh status:** Shared physical-map release, October 4, 2026.

| ID | Decision | Rationale | Verification |
|---|---|---|---|
| D-01 | Strict TypeScript + Vite, no UI framework. | Static one-page app; keep runtime and bundle small. | Type-check and production build. |
| D-02 | No backend, authentication, API, secret, or `.env`. | Self-contained public Pages demo. | Runtime network E2E. |
| D-03 | Make the shared HTML memory→feed→matrix map primary; keep SVG Roofline/table as a technical disclosure. | A novice needs a physical explanation before an abstract plot. CSS transforms provide smooth direction cues without a JavaScript RAF loop. | Lane, source, bottleneck, motion, and optional-chart E2E tests. |
| D-04 | One shared, adjustable compute ceiling for the Roofline chart. | Public peaks use incompatible precision/sparsity/system scopes. The chart isolates bandwidth instead of inventing a leaderboard. | Visible normalization caveat and profile-specific source facts. |
| D-05 | Provenance, units, memory level, scope, and evidence label for each numeric profile field. | Avoid conflating chip/system, precision, claim, derivation, and measurement. | Data fixture tests and source disclosures. |
| D-06 | Eight reference profiles: M4 Max, M5 Pro, M5 Max, Core Ultra 9 285K/Lion Cove, Ryzen 9 9950X/Zen 5, B200, TPU v6e, Groq LPU. | Covers the architectures in the brief. Intel bandwidth remains derived. | Links and qualifications in `research.md`. |
| D-07 | Select all eight profiles by default; use independent include/exclude controls and keep results visible. | The product must compare chips together, not funnel users through one active chip. | E2E default-eight and independent-toggle tests. |
| D-08 | Keep every architecture lane in the same shared 2D space; toggle inclusion on the lane itself. | A selected single-chip inspector obscures the physical comparison and the unselected paths. | Eight labeled lanes persist; independent toggles affect calculations, insight, and technical series only. |
| D-09 | Put the 2D physical map, Decode/Prefill switch, and bottleneck explanation before detailed controls/chart. | Let visitors understand weight traffic and matrix work at a glance, then explore parameters. | First screen at 1280×800; responsive lane map and English audit. |
| D-10 | Test built static output with Playwright; deploy via Node 24 GitHub Actions/Pages. | Verifies the map and real relative assets without a backend; avoid deprecated Node 20 action runtimes. | Physical-map refresh passes 21 local tests; remote workflow runs on publish. |
| D-11 | New public repository `macel94/ai-roofline-lab`. | Free Pages and isolation from all existing repositories. | All source and deployment changes remain isolated to the new repo. |
| D-12 | Display per-chip compute facts with precision/scope, but use one explicit shared teaching rate for matrix-time comparison. | CPU SIMD, Apple AI claims, B200 FP4, TPU BF16/INT8, and Groq claims are not a homogeneous benchmark. Hiding this distinction made the old graph misleading. | E2E checks B200/TPU facts, unknown Groq compute, shared-rate label, and the no-ranking caveat. |

## Parallel reviews

Three independent, read-only Pi reviews ran in parallel via tmux sessions before the initial docs and again for the English/UX refresh:

- Product/spec review: INVEST, EARS, multi-chip state, empty/focus cases.
- Roofline/model review: intensity, precision, capacity, memory levels, source caveats.
- UX/visual/English review: first viewport, multi-select/focus separation, instrument design, en-US terminology, accessibility, and performance.

No reviewer wrote application code. Recommendations were incorporated into the docs before the corresponding implementation changes.
