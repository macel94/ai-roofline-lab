# Test and deployment plan — architecture calculator

**Revision:** October 5, 2026. Supersedes the former 21-test generic-map baseline.

## Test layers

- Strict application/test TypeScript check and Vite production build.
- `tests/model.spec.ts`: original normalized Roofline equations, units, fit, balanced boundaries and validation.
- `tests/architecture.spec.ts`: resource sizing, KV/MoE, 2T Q4/BF16, capacity boundaries, offload, host/local memory constraints, Gbit/s conversion, ring payload/hop latency, blocked/unknown states, target-search limits, and invalid inputs.
- `tests/demo.spec.ts`: actual built static UI in Chromium, distinct physical schematics, hotspots, exact/preset size, unit allocation, network/offload, shape/MoE, per-chip overrides, error recovery, selection/reset, keyboard, optional Roofline, motion and responsive layouts.

- `tests/presets.spec.ts`: six official config fixtures, native vs repacked storage, phase-specific work, hybrid/sliding/MLA/CSA2 cache math, context limits, preset/custom transitions, retained cluster settings, hardware audit corrections and network-budget inversion.
- `tests/design.spec.ts`: typography, contrast, control targets, keyboard/motion, schematic-scroll retention and resized-text reflow.

## Required numerical checks

1. 2T Q4 raw weights = 1,000 decimal GB, working set = 1,200 GB + estimated BF16 KV; default B200 memory floor = 7 units.
2. 2T BF16 raw weights = 4,000 GB; default B200 memory floor = 27 units.
3. Exact capacity boundary uses ceil without truncation; unknown capacity yields no count/rate/target claim.
4. Context affects decode KV traffic and storage; batch increases KV and operations, not resident weights. MoE active fraction reduces work/traffic, not total weight capacity.
5. Resident GPU weights pay zero recurring PCIe cost. Weight offload charges active spilled bytes and separately checks host RAM and local KV/reserve. Unified-memory/TPU paths cannot use fictitious host PCIe offload.
6. One unit has zero ring cost even when disconnected; multiple disconnected units cannot execute. Network Gbit/s is divided by eight; two all-reduces/layer include ring bandwidth and hop latency.
7. More units can increase latency. Target search scans all 1–1,024 integers and explicitly reports failure; it does not extrapolate infinite linear scaling.
8. Unknown bandwidth and invalid/nonfinite/zero memory specifications do not produce a fabricated speed.

## Browser checks

- Nine physical schematics; accessible CPU/GPU/TPU/NPU/LPU type names and architecture-specific internal blocks. TPU has two representative MXUs with systolic cells.
- Default CPU/GPU/TPU/NPU paths are memory-limited; first-generation Groq requires many small SRAM domains and is network-limited; prefill moves processing tiles into the hotspot. Tile duty is derived from math/step time.
- Manual OOM → explicit weight offload → red PCIe bus; slow/disconnected network → red peer link. Oversized host RAM/working set does not hide feasibility constraints.
- Error messages retain last valid diagrams and clear when returning to the same valid input; blur/change does not invalidate pending disclosure clicks.
- Per-chip assumptions explicitly distinguish default/vendor/user evidence, preserve disclosure/focus after applying, and reset to defaults.
- Source links do not fetch at runtime. Core actions remain functional offline. No browser errors or unexpected external requests.
- Keyboard toggles a profile without losing focus and scrolls a focusable mobile schematic. Controls/disclosures work without hover.
- User pause/resume, reduced motion, hidden document and offscreen maps stop motion. Hidden-document handling is tested via a deterministic `visibilityState` override, not a real tab scheduling benchmark.
- 360px, 768px, 1440px: no document-level horizontal overflow. Long diagrams scroll within their own viewport; full-page screenshots go to ignored `test-results/` for review.

## Commands

```sh
npm ci
npx playwright install chromium # one-time setup
npm run test:e2e                # typecheck + build + all tests
npx playwright test --repeat-each=2
npm audit --audit-level=moderate
```

No new third-party runtime dependency is introduced. Expected bundle budget remains below 150 KB gzip JS and 30 KB gzip CSS. No JavaScript per-frame animation/layout loop; offscreen schematics pause individually.

## Publication verification

1. Commit and push source changes to `macel94/ai-roofline-lab` main only after local verification.
2. Wait for the existing GitHub Actions build/test/Pages workflow for that exact SHA.
3. Confirm workflow success and Pages URL: `https://macel94.github.io/ai-roofline-lab/`.
4. Verify HTTP 200 and relative asset availability.
5. Browser-smoke the live site: nine maps, 2T sizing, PCIe/network hotspots, no page errors, mobile width and reduced motion.
6. Confirm remote SHA equals local HEAD and working tree is clean. Do not claim successful publication merely because a push succeeded.

## Verification record

Original architecture results are recorded in [architecture-simulation-plan.md](architecture-simulation-plan.md); current preset/audit verification is in [model-hardware-audit-plan.md](model-hardware-audit-plan.md). Historical generic-map test results are superseded, not reused as evidence for this calculator.
