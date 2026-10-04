# Product Specification — AI Silicon / Roofline Lab

- **Version:** 0.3 — shared physical data-path map
- **Date:** October 4, 2026
- **Status:** Updated to match the physical-map implementation; local E2E suite passes
- **Product language:** English (United States)

## 1. Product vision

AI inference performance depends on more than a chip’s headline compute peak. Model weights must move from a memory tier into CPU, GPU, or accelerator compute blocks; data reuse and matrix work determine which stage waits.

**AI Silicon / Roofline Lab** is a static, interactive learning tool across Apple silicon, x86 CPUs, NVIDIA GPUs, Google TPUs, and Groq LPUs. Its primary surface is one shared 2D map: chip architectures form rows and the physical stages—memory, data feed, matrix engine—form columns. The same workload is traced through all included paths. Visitors see weight bytes, matrix operations, idealized stream time, a shared reference matrix time, and a plain-language explanation of the limiting stage.

The product’s primary action is **compare multiple architectures in one simulation**, then switch Decode and Prefill to see reuse change the wait. The transparent model does not execute an LLM, benchmark hardware, or claim to predict measured performance.

## 2. Target users

- **Learner or educator:** wants to see why compute and memory ceilings matter.
- **ML engineer:** wants to explore how decode/prefill, quantized weight size, and batching affect arithmetic intensity.
- **Hardware analyst:** wants sourced, qualified specifications and a repeatable comparison surface.
- **Stakeholder:** wants to open and share a public demo with no login or service dependency.

## 3. Product scope

### In scope

- Static client-side TypeScript application, entirely in English (en-US), with no authentication, backend, API, analytics, or runtime CDN assets.
- Eight reference profiles: Apple M4 Max, Apple M5 Pro, Apple M5 Max, Intel Lion Cove/Core Ultra 9 285K, AMD Zen 5/Ryzen 9 9950X, NVIDIA Blackwell B200, Google TPU v6e/Trillium, and Groq LPU.
- All eight profiles included in the initial comparison.
- Independent include/exclude controls, “Select all,” “Clear all,” and reset-to-default.
- Workload controls for decode/prefill, model size, weight bits, batch, prompt length, a shared normalized compute ceiling, and configurable host RAM for x86 profiles.
- A shared 2D memory-to-engine map with eight aligned chip lanes; lane controls include/exclude profiles without hiding the other architecture paths.
- A workload receipt (weight GB, matrix GFLOP, FLOP/byte), idealized per-lane weight-stream time, shared reference matrix time, and a plain-language live bottleneck explanation.
- Per-chip memory level, bandwidth/capacity evidence, compute-engine type, sourced precision/scope-specific compute facts, fit state, and source link.
- An optional technical disclosure with the Roofline chart, accessible comparison table, and formulas.
- Lightweight CSS transform motion with pause, reduced-motion, hidden-tab, and offscreen suspension.
- Free deployment to GitHub Pages from a new public repository.

### Out of scope

- Executing an LLM, GPU kernel, cloud workload, or hardware benchmark.
- Login, user account, database, backend, telemetry, API, or automatic data refresh.
- Measured token/s, latency, energy, cost, or a universal vendor ranking.
- Exact simulation of caches, kernel occupancy, KV cache, network fabrics, compilers, scheduling, or thermal throttling.
- Presenting unlike FP4, BF16, INT8, FP16, CPU, and sparse/dense peaks as a single comparable benchmark.

## 4. INVEST user stories

| ID | User story | Independent | Negotiable | Valuable | Estimable | Small | Testable |
|---|---|---|---|---|---|---|---|
| US-01 | As a visitor, I want to see the memory-to-engine map and a plain-language bottleneck explanation immediately so I can understand the core idea without reading a long introduction. | Uses the shared initial scenario. | Exact visual treatment may change. | Delivers the educational “why” immediately. | One shared map and insight panel. | One entry viewport. | E2E at 1280×800. |
| US-02 | As a user, I want all eight chips shown in aligned memory→data-feed→matrix-engine lanes so I can compare their physical paths under identical inputs. | Uses a shared calculation input. | Lane styling may change. | Core product value and shared spatial context. | Fixed profile dataset. | One 2D map. | Eight included lanes and per-lane bottleneck state on load. |
| US-03 | As a user, I want to add/remove profiles independently so I can reduce visual clutter without losing other results. | Per-profile inclusion is independent. | Colors and chip layout are negotiable. | Supports focused analysis. | Boolean inclusion per profile. | Toggle one profile. | Toggle preserves the other seven. |
| US-04 | As a learner, I want to see where weights are stored, how they reach each engine, and what compute facts are published so I can distinguish data movement from matrix throughput. | Every architecture has a labeled lane and source. | The amount of detail is tunable. | Builds a physical mental model without a false leaderboard. | Profile facts are already typed and sourced. | One engine/memory explanation per lane. | E2E checks DDR, UMA, HBM, SRAM, engine labels, and cited compute facts. |
| US-05 | As an ML engineer, I want to adjust workload phase, model size, precision, batch, and context so I can explore how arithmetic intensity changes. | The model is a pure function. | Presets/ranges may be tuned. | Explains workload-dependent limits. | Inputs and formulas are bounded. | One scenario panel. | Numerical model tests. |
| US-06 | As a reviewer, I want sources and assumptions beside the results so I can distinguish published facts, derived values, and vendor claims. | Provenance is attached to each profile. | Disclosure layout is negotiable. | Prevents false precision. | Static source metadata. | One provenance panel. | Labels/links are testable. |
| US-07 | As a keyboard, mobile, or reduced-motion user, I want the complete comparison to remain operable so the experience does not depend on hover, color, or animation. | Uses shared controls and semantics. | Visual details may change. | Inclusive access. | WCAG/responsive constraints. | One accessibility pass. | Playwright + manual checks. |

**INVEST review:** Each story can be implemented against the shared typed scenario/profile model without requiring another story’s visual component. Details remain negotiable; every story is bounded and has a measurable acceptance test.

## 5. EARS requirements

EARS patterns used below: **Ubiquitous** (always), **Event-driven** (when an event occurs), **State-driven** (while a state holds), **Optional** (when a feature is enabled), and **Unwanted behavior** (if an invalid condition occurs).

### R-01 — English-only product (Ubiquitous)
The system shall use English (en-US) for all user-visible text, profile data, accessible names, errors, tests, metadata, README, and project documentation.

- **Given** any screen or profile, **When** its text is rendered, **Then** the copy is English and uses the shared terminology glossary.
- **Given** a number is displayed, **When** it is formatted, **Then** it uses a decimal point, comma grouping, and consistent SI units.

### R-02 — Static and unauthenticated (Ubiquitous)
The system shall run as a static client-side site without login, application server, API, secret, analytics, or external runtime asset.

### R-03 — Exact eight-profile catalog (Ubiquitous)
The system shall contain exactly the eight reference profiles named in Section 3, with a source/evidence state for each numeric hardware value.

### R-04 — Default shared physical map (Event-driven)
When a clean session opens, the system shall include all eight profiles in one 2D memory-to-matrix map, show the included count, and explain the default workload’s limiting stage.

- **Given** a clean load, **When** the initial map is rendered, **Then** eight labeled chip lanes appear in a shared memory→data-feed→matrix-engine space and all eight are included.
- **Given** a 1280×800 viewport at 100% zoom, **When** the page is at its top, **Then** the workload phase switch, weight/matrix-work receipt, plain-language bottleneck explanation, and start of the physical map appear before the detailed controls or technical chart.

### R-05 — Independent inclusion (Event-driven)
When a user toggles a profile’s inclusion control, the system shall add or remove only that profile’s line and comparison result.

- **Given** eight profiles selected, **When** one is excluded, **Then** the other seven remain selected and their input/results are unchanged.
- **Given** fewer than eight selected, **When** “Select all” or reset-to-default is activated, **Then** all eight return.
- **Given** zero profiles selected, **When** the comparison is rendered, **Then** an explicit empty state and “Select all” action appear; stale results are not shown.

### R-06 — Always-visible physical results (State-driven)
While profiles are included, the system shall keep each lane’s memory source, transfer rate, compute engine, two modeled stage times, bottleneck, capacity-fit state, and source available in the shared map; the technical table may remain in a disclosure.

The map shall identify memory tiers such as system DDR, unified memory, HBM, and on-chip SRAM, and name the corresponding CPU/accelerator engine. A stage shall be highlighted with a text label as well as color.

### R-07 — Shared workload inputs (Event-driven)
When the user changes phase, model parameters, weight bits, batch, prompt tokens, normalized compute ceiling, or host RAM, the system shall recompute all included profiles from the same input state.

Default scenario: 7B parameters, 4-bit weights, batch 1, decode, 512 prompt tokens, shared compute ceiling 1,000 TFLOP/s, host RAM 128 GB.

### R-08 — Honest compute comparison (Ubiquitous)
The system shall label the shared adjustable compute rate as an illustrative teaching reference, never as a chip-specific peak. It shall display each available vendor compute fact with its own precision, scope, and evidence, and shall not rank incompatible CPU/GPU/TPU/LPU peaks together.

### R-09 — Roofline and stage-time calculation (Ubiquitous)
The system shall compute `P_attainable = min(P_ref, BW × I)`, ideal weight-stream time `T_data_ms = W_GB / BW_GB/s × 1000`, and reference matrix time `T_math_ms = F_GFLOP / P_ref_TFLOP/s`. It shall classify and visibly identify the slower stage; these are model outputs, not measured latency.

### R-10 — Capacity fit (Unwanted behavior / State-driven)
If the estimated working set exceeds a known capacity, the system shall label the profile “Does not fit” for that configured profile; if capacity is unknown, it shall show “Unknown” rather than fit or zero.

### R-11 — Source and evidence (Ubiquitous)
Each hardware value shall show units, memory level, device/system scope, source, and one of manufacturer-reported, derived, manufacturer claim, illustrative, or unknown.

### R-12 — Validation and empty/error states (Unwanted behavior)
If an input is invalid or out of range, the system shall show an actionable inline English message and shall not silently calculate from a substituted value.

### R-13 — Accessibility and responsive design (Ubiquitous)
The system shall support keyboard operation, visible focus, accessible names, non-color series identification, WCAG 2.2 AA contrast, reduced motion, and responsive layouts from 360 px to desktop.

### R-14 — Accessible flow motion (State-driven)
The system shall animate the data-feed cue with CSS transforms, never encode data solely in motion, and explain that animation speed is a log-scaled visual cue rather than literal packet timing. It shall pause on user request, `prefers-reduced-motion`, hidden tab, or when the map is outside the meaningful viewport. Calculations and selection remain functional when motion is paused.

### R-15 — Per-lane teaching times (State-driven)
While a chip is included, the system shall show idealized memory-stream time from its cited bandwidth and workload weight bytes, plus matrix-work time at the shared reference rate. It shall state that the reference rate is not a chip specification, that weight precision does not define compute precision, and that peak/derived/claimed bandwidth does not predict measured latency.

### R-16 — Comparison responsiveness (State-driven)
While all eight profiles are included, changing phase, workload input, or selection shall update the map, explanation, and technical comparison without blocking interaction; target update time is under 100 ms on the reference desktop.

## 6. English terminology and formatting

- **Arithmetic intensity:** FLOP/byte; never abbreviate as “AI.”
- **Peak compute:** precision-specific manufacturer/theoretical metric, not a measured result.
- **Attainable performance:** Roofline upper bound.
- **Memory bandwidth:** always identify the level (UMA, DDR5, HBM, SRAM).
- **Memory-bound / compute-bound:** hyphenated.
- **Fits / Does not fit / Unknown:** distinct capacity states.
- Use en-US formatting (e.g. `2,048`, `2.5`, `1,638 GB/s`), decimal GB/GB/s, and `FLOP/s`, `TFLOP/s`, `PFLOP/s` consistently.

## 7. Definition of Done

- All visible and documentation content is English.
- All eight profiles are selected by default; inclusion toggles are independent; a zero-selection empty state exists.
- The shared 2D map shows all eight physical paths together, with memory, engine, data rate, stage times, and a labeled bottleneck.
- Decode/Prefill demonstrates weight reuse moving the modeled bottleneck; compute facts remain scoped and non-comparable when precision differs.
- The “why” story appears at 1280×800 before the detailed form or Roofline chart.
- Unit tests cover the math and edge cases; E2E covers the map, independent lane toggles, Decode/Prefill, compute facts, keyboard, mobile, reduced motion, offscreen pause, and live sources.
- The static GitHub Pages site deploys successfully and the live URL returns 200 with working relative assets.
