# Technical Design — AI Silicon / Roofline Lab

**Physical-map refresh:** October 4, 2026.

This design records the English shared-silicon-map interaction: physical memory-to-engine lanes are primary; the Roofline chart is an optional technical view.

## 1. Parallel review input

Three independent, read-only Pi reviewers ran in parallel in tmux sessions before the initial English refresh:

1. **UX/product:** first-screen layout, comparison behavior, acceptance cases.
2. **Visual/performance:** dark instrument art direction, chart hierarchy, mobile and motion.
3. **English/content:** en-US terminology, number formatting, data/source language.

Those reviews informed the static English baseline and accessible multi-chip controls. The shared physical-map revision then responded directly to visitor feedback that an abstract graph did not explain the hardware-level cause of a bottleneck.

## 2. Architecture decisions

### ADR-01 — Vanilla TypeScript, no UI framework

Use strict TypeScript with Vite and native DOM, SVG, and CSS transform animations. The application is one static page with a small fixed profile set, so a framework/chart library adds runtime weight without adding needed capabilities.

Verified toolchain: Vite 8.3.2 (Node `^20.19.0 || >=22.12.0`), TypeScript 7.0.2 (Node `>=16.20.0`), `@playwright/test` 1.63.0 (Node `>=20`). Local and CI runtime: Node 24.

### ADR-02 — Comparison is multi-select by default

The state model stores `selectedProfileIds: Set<ProfileId>`, initialized to all eight IDs. Each architecture’s button lives directly in its map lane and toggles membership independently. “Select all” and “Clear all” operate on the set; excluded lanes remain visible but dimmed so the shared physical space does not disappear.

All included profiles use the same workload input and are recalculated in one render. The shared map shows memory, feed path, engine, fit, and bottleneck for every included lane. The optional Roofline chart and numeric table are in a disclosure. An empty selection has an explicit explanation and a Select all action.

### ADR-03 — Physical map first, technical chart second

The first simulator view puts the shared 2D map before the detailed workload form and Roofline chart. The map’s vertical axis is architecture (one lane per chip); its horizontal axis is the physical sequence: weight memory → data feed → matrix engine. Above it, the phase switch and workload receipt show bytes, operations, intensity, and a short plain-language causal explanation. Lane buttons provide include/exclude; all eight remain visible by default.

At 1280×800 the phase switch, workload explanation, and map start are visible without an introductory gallery. On narrow viewports each lane stacks into readable memory, feed, and engine stages without document-level horizontal overflow. The detailed form follows the main map; the Roofline chart and table are disclosed as a technical lens.

### ADR-04 — Explicit stage times; CSS-only flow cue

- The map shows `T_data = weight bytes / cited bandwidth` and `T_math = workload GFLOP / shared reference TFLOP/s`; each is clearly described as an idealized teaching time, not measured inference latency.
- The shared matrix rate is adjustable and deliberately identical for every profile. Profile-specific engine facts retain their precision, scope, and evidence; unlike peaks are not ranked together.
- Each physical path is drawn as aligned HTML stages. A small CSS transform signal conveys direction; its log-scaled speed is only a visual cue. There is no JavaScript animation loop or per-frame DOM/layout work.
- The signal pauses on user request, reduced motion, a hidden document, or when the meaningful map area is outside the viewport. Bottleneck state has text and stage emphasis, not color alone.
- The SVG Roofline is recalculated only on input/selection and remains available in the technical disclosure.

### ADR-05 — Static, typed provenance

Hardware values carry `value`, `unit`, `memoryLevel`, `scope`, `evidence` (`vendor`, `derived`, `vendor-claim`, `illustrative`, `unknown`), `sourceUrl`, and a note. Unknown values are `null`, never zero. GB and GB/s are decimal units (1 GB = 10⁹ bytes).

## 3. First-screen interaction layout

```text
Header: AI Silicon / Roofline Lab                 Method & sources
Compact title: Why does AI wait?                   Memory → data → matrix
Shared 2D map: eight chip rows × [memory store] → [animated feed] → [matrix engine]
Quick phase switch: Decode / Prefill
Workload receipt: [weight GB] → [matrix GFLOP] · [FLOP/byte]
Live explanation: number of paths waiting for data vs matrix work, and why
Each lane: capacity/fit · cited bandwidth · ideal stream time · engine · scoped compute fact · reference time
Lane toggles: [8 of 8] · Select all · Clear all · Pause flow
Below the map: model-size/precision/batch/context controls · optional Roofline and result table
```

**Art direction:** deep ink/navy instrument surface, luminous cyan/violet/amber/lime chip traces, aligned memory→engine stages, clear type hierarchy, and moving data cues. Use no remote font, image, icon library, or runtime asset.

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

The adjustable compute roof is one shared teaching rate used for the reference matrix-time and optional Roofline calculations. It isolates bandwidth effects; it is not a per-chip peak. Each lane also displays the profile’s available `performanceFact` and `performanceEvidence` (for example, B200 FP4 dense, TPU v6e BF16/INT8, or unknown/not comparable for other profiles). These facts retain their own precision and scope and are never ranked together. Weight storage bits do not establish compute precision.

## 5. Workload model

Inputs: `N` model parameters (billions), `q` weight bits, `B` batch, `K` tokens per step (1 for decode, selected prompt length for prefill), memory bandwidth `BW` in decimal GB/s, and shared normalized compute ceiling `P_ref` in TFLOP/s.

```text
W_GB = N × q / 8
M_est_GB = W_GB × 1.20
F_GFLOP_per_step = 2 × N × B × K
I_FLOP_per_byte = F_GFLOP_per_step / W_GB = 16 × B × K / q
P_memory_TFLOP/s = BW_GB/s × I_FLOP/byte / 1000
P_attainable_TFLOP/s = min(P_ref_TFLOP/s, P_memory_TFLOP/s)
T_data_ms = W_GB / BW_GB/s × 1000
T_math_ms = F_GFLOP / P_ref_TFLOP/s
I_ridge = P_ref_TFLOP/s × 1000 / BW_GB/s
```

A MAC counts as two operations. We assume the dense weights are fetched once and reused across the batch/prompt. The 20% fit reserve is generic, not a KV-cache/workspace model. Attention, KV traffic, quantization metadata/dequantization, activation, kernel scheduling, interconnect, PCIe, thermal state, and software efficiency are excluded. Quantized weight bits do not establish the arithmetic precision of the engine.

Classification: data-feed limited below 95% of the shared compute roof; matrix-work limited above 105%; balanced within ±5%; unknown if required profile data is unavailable. The map compares the idealized stage times `T_data` and `T_math`; peak bandwidth makes `T_data` optimistic, and `T_math` uses the same reference rate on every chip. Neither is a real latency prediction. A non-fitting model remains visibly marked “Does not fit”; its timing/point assumes resident weights and is not a claim that the single device can run that scenario.

## 6. Source layout

```text
index.html
vite.config.ts
playwright.config.ts
src/
  main.ts                 # workload, lane selection, rendering, and motion state
  styles.css              # responsive English UI and visual states
  domain/model.ts         # calculations, unit validation, fit, bottleneck
  data/profiles.ts        # eight sourced profiles
  visuals/roofline.ts     # optional SVG chart, legend, technical comparison table
  visuals/silicon-map.ts  # shared 2D lanes, workload explanation, stage times
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
