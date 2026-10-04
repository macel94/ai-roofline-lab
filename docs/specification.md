# Product Specification — AI Silicon / Roofline Lab

- **Version:** 0.2 — English simulator-first refresh
- **Date:** October 4, 2026
- **Status:** Refresh specification frozen before implementation changes
- **Product language:** English (United States)

## 1. Product vision

AI inference performance is not determined by peak compute alone. Memory hierarchy, data reuse, bandwidth, numeric precision, and workload phase can move a workload between memory-bound and compute-bound regimes.

**AI Silicon / Roofline Lab** is a static, interactive comparison tool for exploring those trade-offs across Apple silicon, x86 CPUs, NVIDIA GPUs, Google TPUs, and Groq LPUs. The simulator uses a transparent educational Roofline model; it does not execute an LLM and does not claim to predict measured hardware performance.

The product’s primary action is **compare multiple architectures in one simulation**. A single-profile data-path inspection is optional and must never replace or narrow the comparison set.

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
- Roofline chart, always-visible per-profile comparison results, and accessible table semantics.
- Optional focused data-path view, independent of which profiles are included in the comparison.
- Source, unit, scope, and evidence labels for hardware figures.
- Lightweight data-flow animation with pause, reduced-motion, hidden-tab, and offscreen suspension.
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
| US-01 | As a visitor, I want the simulator visible immediately so I can try it without reading a long introduction. | Uses the shared initial scenario. | Exact hero copy/layout may change. | Delivers the main value immediately. | One compact first-screen layout. | One entry viewport. | E2E at 1280×800. |
| US-02 | As a user, I want all eight chips compared together so I can see differences under identical inputs. | Uses a shared calculation input. | Selector presentation may change. | Core product value. | Fixed profile dataset. | One comparison state. | Eight lines and eight results on load. |
| US-03 | As a user, I want to add/remove profiles independently so I can reduce visual clutter without losing other results. | Per-profile inclusion is independent. | Colors and chip layout are negotiable. | Supports focused analysis. | Boolean inclusion per profile. | Toggle one profile. | Toggle preserves the other seven. |
| US-04 | As a user, I want to focus a chip’s data path while keeping the comparison visible so I can inspect one architecture without reverting to a single-chip simulation. | Focus is separate from inclusion. | Detail-panel content is extensible. | Explains architecture mechanics. | One optional focused view. | One profile at a time, comparison remains multi-profile. | E2E verifies curves/results stay selected. |
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

### R-04 — Default multi-chip comparison (Event-driven)
When a clean session opens, the system shall include all eight profiles, show the selected count, plot all available Roofline curves, and render one result row/card per included profile.

- **Given** a clean load, **When** the first comparison is rendered, **Then** all eight profiles are selected simultaneously and no profile is focused.
- **Given** a 1280×800 viewport at 100% zoom, **When** the page is at its top, **Then** the primary inputs, profile inclusion controls, chart, and comparison summary are visible or directly operable without scrolling through an introductory gallery.

### R-05 — Independent inclusion (Event-driven)
When a user toggles a profile’s inclusion control, the system shall add or remove only that profile’s line and comparison result.

- **Given** eight profiles selected, **When** one is excluded, **Then** the other seven remain selected and their input/results are unchanged.
- **Given** fewer than eight selected, **When** “Select all” or reset-to-default is activated, **Then** all eight return.
- **Given** zero profiles selected, **When** the comparison is rendered, **Then** an explicit empty state and “Select all” action appear; stale results are not shown.

### R-06 — Always-visible results (State-driven)
While profiles are included, the system shall keep their result summaries visible by default; the user shall not need to open a collapsed table or select one chip to compare them.

Each row shall identify the profile, bandwidth/memory scope, modeled memory roof, bottleneck state, and capacity-fit state.

### R-07 — Shared workload inputs (Event-driven)
When the user changes phase, model parameters, weight bits, batch, prompt tokens, normalized compute ceiling, or host RAM, the system shall recompute all included profiles from the same input state.

Default scenario: 7B parameters, 4-bit weights, batch 1, decode, 512 prompt tokens, shared compute ceiling 1,000 TFLOP/s, host RAM 128 GB.

### R-08 — Optional architecture focus (Optional)
When a user chooses a profile in “Data path focus,” the system shall emphasize its memory/compute flow without removing, replacing, or hiding any included curve or result.

### R-09 — Roofline calculation (Ubiquitous)
The system shall compute `P_attainable = min(P_peak, BW × I)` with documented units, show arithmetic intensity and both ceilings, and classify memory-bound, compute-bound, balanced (within ±5%), or unknown.

### R-10 — Capacity fit (Unwanted behavior / State-driven)
If the estimated working set exceeds a known capacity, the system shall label the profile “Does not fit” for that configured profile; if capacity is unknown, it shall show “Unknown” rather than fit or zero.

### R-11 — Source and evidence (Ubiquitous)
Each hardware value shall show units, memory level, device/system scope, source, and one of manufacturer-reported, derived, manufacturer claim, illustrative, or unknown.

### R-12 — Validation and empty/error states (Unwanted behavior)
If an input is invalid or out of range, the system shall show an actionable inline English message and shall not silently calculate from a substituted value.

### R-13 — Accessibility and responsive design (Ubiquitous)
The system shall support keyboard operation, visible focus, accessible names, non-color series identification, WCAG 2.2 AA contrast, reduced motion, and responsive layouts from 360 px to desktop.

### R-14 — Performance and motion (State-driven)
While the canvas is playing, its element intersects the viewport, the document is visible, and reduced motion is not requested, the system shall animate at a target of 60 fps with a bounded `requestAnimationFrame` loop and no per-frame DOM/layout updates. It shall suspend when paused, hidden, offscreen, or reduced-motion is enabled.

### R-15 — Comparison performance (State-driven)
While all eight profiles are included, changing an input or selection shall keep the interface responsive; target update time is under 100 ms on the reference desktop, with 60 fps as the animation goal and 55 fps minimum operational tolerance for the local performance check.

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
- Comparison results stay visible for every included chip when a data-path profile is focused.
- The primary lab is usable at 1280×800 without an introductory gallery scroll.
- Unit tests cover the math and edge cases; E2E covers default multi-select, toggles, focus, English accessibility names, keyboard, mobile, motion, and live sources.
- The static GitHub Pages site deploys successfully and the live URL returns 200 with working relative assets.
