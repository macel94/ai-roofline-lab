# Technical Design — AI Silicon / Roofline Lab

**Refresh baseline:** October 4, 2026.

This design freezes the English, simulator-first, multi-chip interaction before implementation changes.

## 1. Parallel review input

Three independent, read-only Pi reviewers ran in parallel in tmux sessions before this design update:

1. **UX/product:** first-screen layout, independent selection/focus, acceptance cases.
2. **Visual/performance:** dark instrument art direction, chart hierarchy, mobile and motion.
3. **English/content:** en-US terminology, number formatting, data/source language.

Accepted recommendations: put the simulator first; show eight selected profiles and a selected count; keep comparison inclusion separate from optional single-profile data-path focus; keep per-chip results visible; use keyboard/tooltips and non-color chart encodings; suspend animation offscreen and under reduced motion.

## 2. Architecture decisions

### ADR-01 — Vanilla TypeScript, no UI framework

Use strict TypeScript with Vite; DOM, SVG, and Canvas APIs only. The application is one static page with a small fixed profile set, so a framework/chart library adds runtime weight without adding needed capabilities.

Verified toolchain: Vite 8.3.2 (Node `^20.19.0 || >=22.12.0`), TypeScript 7.0.2 (Node `>=16.20.0`), `@playwright/test` 1.63.0 (Node `>=20`). Local and CI runtime: Node 24.

### ADR-02 — Comparison is multi-select by default

The state model stores `selectedProfileIds: Set<ProfileId>`, initialized to all eight IDs. A profile selector toggles membership independently. “Select all” and “Clear all” operate on the set. A separate `flowProfileId: ProfileId | null` controls the optional data-path focus and never filters the comparison.

All selected profiles use the same immutable workload input and are recalculated in one render. The comparison list/table stays open and visible by default. An empty selection has an explicit empty state with a Select all action.

### ADR-03 — Simulator-first responsive layout

The first page view is a compact title bar, the workload controls, the eight-profile inclusion row, the main Roofline plot, and the comparison summary. Long architecture explanation, detailed citations, and data-path narrative are below or beside the lab, not before it.

At 1280×800 the primary inputs, all-profile selection state, chart, and first comparison summaries must be visible or immediately operable. On narrow viewports, controls stack compactly, the chart remains near the top, and profile chips may scroll horizontally.

### ADR-04 — SVG comparison chart, Canvas data path

- SVG draws at most eight Roofline lines plus a cursor/marker; it updates on input or selection, not per animation frame.
- A single Canvas `requestAnimationFrame` loop animates 22 data particles for the optional data path. It uses delta time, DPR ≤1.5, no per-frame DOM changes, and suspends when paused, document-hidden, canvas offscreen, or `prefers-reduced-motion` is active.
- Color is paired with dash/point shape, labels, and a text results view.

### ADR-05 — Static, typed provenance

Hardware values carry `value`, `unit`, `memoryLevel`, `scope`, `evidence` (`vendor`, `derived`, `vendor-claim`, `illustrative`, `unknown`), `sourceUrl`, and a note. Unknown values are `null`, never zero. GB and GB/s are decimal units (1 GB = 10⁹ bytes).

## 3. First-screen interaction layout

```text
Header: AI Silicon / Roofline Lab                 Method & sources
Compact title: Where AI compute hits the wall?
Workload controls: phase · model · weight bits · batch · prompt · compute ceiling
Profile row: [8 of 8 selected]  M4  M5 Pro  M5 Max  Intel  AMD  B200  TPU  Groq
Main lab: Roofline chart (large)       Always-visible comparison results (8 rows)
Optional focus: Data path for [profile selector] · pause · reduced motion
Below the lab: architecture notes · source provenance · assumptions
```

**Art direction:** deep ink/navy instrument surface, luminous cyan/violet/amber/lime chip traces, clear type hierarchy, compact grid, visible cursor and ridge point. Use no remote font, image, icon library, or runtime asset.

## 4. Profile data and qualification

| Profile | Roofline bandwidth | Capacity used for fit | Evidence / scope |
|---|---:|---|---|
| Apple M4 Max | 546 GB/s UMA | up to 128 GB | Apple maximums; exact Mac configuration may be lower. |
| Apple M5 Pro | 307 GB/s UMA | up to 64 GB | Apple maximums. |
| Apple M5 Max | 614 GB/s UMA | up to 128 GB | Apple maximums; not a sustained benchmark. |
| Intel Lion Cove / Core Ultra 9 285K | 102.4 GB/s theoretical | user-configured host RAM | Derived from two DDR5-6400 channels; not measured and specific to a reference platform. |
| AMD Zen 5 / Ryzen 9 9950X | 89.6 GB/s theoretical | user-configured host RAM | Derived from two DDR5-5600 channels; not measured. |
| NVIDIA Blackwell B200 (one GPU in DGX B200) | 8,000 GB/s HBM3e | 180 GB | Derived by dividing NVIDIA DGX B200 8-GPU system totals by eight. |
| Google TPU v6e / Trillium (one chip) | 1,638 GB/s HBM | 32 GB | Google per-chip published values. BF16/INT8 peaks are shown separately. |
| Groq LPU | ≥80,000 GB/s on-chip SRAM | unknown | Manufacturer claim from Groq’s architecture page; capacity not stated in cited source. |

The compute roof in the interactive Roofline plot is one shared user-editable normalization ceiling. It isolates the impact of bandwidth and avoids ranking unlike CPU/GPU/TPU/LPU peaks and precisions. Product-specific vendor compute facts remain separately labeled with their precision and scope.

## 5. Workload model

Inputs: `N` model parameters (billions), `q` weight bits, `B` batch, `K` tokens per step (1 for decode, selected prompt length for prefill), memory bandwidth `BW` in decimal GB/s, and shared normalized compute ceiling `P_ref` in TFLOP/s.

```text
W_GB = N × q / 8
M_est_GB = W_GB × 1.20
F_GFLOP_per_step = 2 × N × B × K
I_FLOP_per_byte = F_GFLOP_per_step / W_GB = 16 × B × K / q
P_memory_TFLOP/s = BW_GB/s × I_FLOP/byte / 1000
P_attainable_TFLOP/s = min(P_ref_TFLOP/s, P_memory_TFLOP/s)
I_ridge = P_ref_TFLOP/s × 1000 / BW_GB/s
```

A MAC counts as two operations. We assume the dense weights are fetched once and reused across the batch/prompt. The 20% fit reserve is generic, not a KV-cache/workspace model. Attention, KV traffic, quantization metadata/dequantization, activation, kernel scheduling, interconnect, PCIe, thermal state, and software efficiency are excluded. Quantized weight bits do not establish the arithmetic precision of the engine.

Classification: memory-bound below 95% of the shared compute roof; compute-bound above 105%; balanced within ±5%; unknown if required profile data is unavailable. A non-fitting model remains visibly marked “Does not fit”; its Roofline point is an idealized resident-data bound, not a claim that the single device can run that scenario.

## 6. Source layout

```text
index.html
vite.config.ts
playwright.config.ts
src/
  main.ts                 # state, controls, rendering, multi-selection/focus
  styles.css              # responsive English UI and visual states
  domain/model.ts         # calculations, unit validation, fit, bottleneck
  data/profiles.ts        # eight sourced profiles
  visuals/roofline.ts     # SVG chart, legend, always-visible result table
  visuals/data-flow.ts    # Canvas + requestAnimationFrame
public/favicon.svg
tests/
  model.spec.ts
  demo.spec.ts
```

## 7. Security and deployment

- No `.env`, credential, login, cookie, analytics, API, or runtime network request.
- External source links are voluntary navigation with `rel="noreferrer"`.
- Repository: `macel94/ai-roofline-lab` (public, new repo only).
- Live site: `https://macel94.github.io/ai-roofline-lab/`.
- Vite `base: './'` keeps generated assets relative under the GitHub Pages repository path.
- GitHub Actions uses Node 24 and the current official major releases: checkout v7, setup-node v7, configure-pages v6, upload-pages-artifact v5, deploy-pages v5; permissions are limited to contents read, Pages write, and id-token write.
- Public GitHub Pages is free on GitHub Free.
