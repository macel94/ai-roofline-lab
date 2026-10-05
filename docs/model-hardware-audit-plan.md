# Model presets and hardware assumptions audit

## Goal
Source every chip default, add popular open-weight model presets (including Qwen3.8-27B and DeepSeek-V4.1-Flash), and guide target-rate planning without inventing runtime support or benchmark throughput.

## Delivery checklist
- [x] Read vendor hardware references and official model cards/configs/checkpoint indexes.
- [x] Identify hybrid attention, sliding windows, MLA, mixed checkpoint formats, phase-specific active parameters, and Groq generation scope.
- [x] Implement local, revision-pinned model metadata and cache calculations.
- [x] Correct/audit hardware defaults; distinguish peaks, derived values, and assumptions.
- [x] Add interactive presets and a resource/target-rate shortlist; preserve custom controls.
- [x] Add regression tests; review desktop/mobile, offline behavior, and accessibility.
- [x] Document equations, caveats, and audit evidence; verify the production build. Publication was not performed.

## Design
Keep the existing dark lab and native controls. Selecting a named model fills checkpoint storage, total/active parameters, layer count, hidden width, and cache layout. Phase/context/batch/target/network/unit/offload settings remain unchanged. Explicit uniform precision overrides are theoretical repacks, not available checkpoints. Shape edits switch to a custom GQA model so stale special-cache rules cannot survive. Native mixed-precision traffic is a conservative BF16-active-weight bound, not a claim to know actual kernel reads. Results remain optimistic resource estimates, not purchase recommendations or proof of runtime compatibility.

Model-specific caches replace the generic full-GQA formula: full and sliding layers, Qwen recurrent state, MLA latent width, and DeepSeek shared compressed sources. Runtime allocations/workspaces and replicated caches remain implementation-dependent. The generic 20% weight reserve is retained and labeled.

A shortlist compares selected chip paths using current settings, showing fit floor, smallest modeled target count, storage/headroom, local bandwidth, bus, and communication sensitivity. Never silently substitute vendor aggregate NVLink/ICI bandwidth for usable per-rank ring throughput.

## Verification record — October 5, 2026

- Six official revision-pinned configs matched the audited downloads and are retained as offline test fixtures. All six native index sizes were cross-checked against listed shard-file totals; differences were small headers only.
- Strict application/test TypeScript and Vite production build passed. Production JS is about 22.6 KB gzip; CSS about 5.75 KB gzip. No runtime dependency added.
- Initial 72 tests passed. Expanded tests exposed a six-model browser test exceeding its 15-second budget; the captured page retained correct values. Split into six independently bounded tests rather than changing global timeouts.
- Final **80 tests repeated twice: 160/160 passed**, including the final independent manual-KV-width fix. Earlier repeated verification also passed 160/160.
- `npm audit --audit-level=moderate`: **0 vulnerabilities**. `git diff --check`: clean.
- Installed Impeccable context and distill guidance used; one final detector run exited 0 with `[]` (no findings). This is detector evidence, not accessibility certification.
- Reviewed `.impeccable/review/models-desktop.png`, `models-plan-desktop.png`, `models-mobile-320.png`, and `models-mobile-360.png`. Native disclosures, restrained styling and readable roles preserved.
- All six named presets tested at 320/360px with 200% HTML text and open evidence/shortlist disclosures: no document overflow. Existing contrast, target, keyboard, motion and offline tests passed. No browser errors or external runtime requests.
- Intel ARK access remains blocked; representative DDR figures are qualified. CPU/Apple/Groq/B200 math ceilings remain editable assumptions, not newly verified hardware specs.
- Complete equations/provenance: [hardware-model-audit.md](hardware-model-audit.md). No Git staging, commit, push or deployment was performed; this delivery remains local.
