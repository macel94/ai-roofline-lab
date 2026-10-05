# Architecture bottleneck simulation and model-sizing plan

## Request
Replace the generic memory-to-compute illustration with physical CPU, GPU, TPU, and NPU schematics that locate capacity, memory-controller/bus, compute, and network constraints. Support 1B–2T models and calculate units needed, with visible explanations. Preserve a separate normalized Roofline teaching lens. Commit and push after verification.

## Checklist
- [x] Inspect implementation and tests; research primary hardware and inference references.
- [x] Define equations, boundaries, and implementation plan in this document.
- [x] Implement a pure, validated resource/sizing model with unit tests.
- [x] Implement distinct animated physical schematics and resource heat overlays.
- [x] Add model presets/exact size, network, unit count, offload, KV/MoE, and target-rate controls.
- [x] Verify production build, numerical edge cases, browser behavior, reduced motion, mobile overflow, and screenshots.
- [ ] Update documentation, commit, push, and verify publication.

## Design
Keep the published memory profiles and optional normalized Roofline. Add a separate architecture resource model. Dedicated NPU lane uses the M4 Max package's shared memory; its effective matrix rate is an explicit illustrative assumption, NOT the vendor's Neural Engine TOPS claim. CPU/Apple/Groq effective rates are similarly labeled assumptions where comparable dense BF16 peaks are unavailable. B200 uses an explicitly illustrative BF16 ceiling; TPU uses the vendor BF16 peak. Both are discounted by an editable utilization factor. Q4 storage never automatically implies Q4 arithmetic.

Physical schematics are symbolic floorplans, not transistor-accurate layouts: CPU DIMMs → memory controller → L3 → cores/L1/L2; GPU host RAM → PCIe → HBM controllers → L2 → SM/Tensor tiles; TPU HBM → on-chip buffers → systolic MXU and ICI; NPU unified RAM → shared fabric → SRAM → MAC tiles; Apple GPU shares a package with inactive CPU/NPU blocks; Groq uses distributed SRAM/dataflow. Highlight constrained components red with a text label, faster components green, capacity occupancy blocks, queue dots, moving packets, and stage service-time bars. Every lane shares the same visual speed scale; playback compresses time, never claims clock accuracy. Pausing/reduced motion preserves all numerical and color information.

## Equations and explicit limitations
- Decimal GB throughout. Weights = total parameters × storage bits / 8. Reserve = 20% of weights.
- Generic dense Transformer shape: estimated layers = round(32 × (P/7B)^0.25); hidden width = round(sqrt(P/(12 × layers))). These are assumptions inferred from size, not actual model metadata. Expose layer count, hidden width, and KV width ratio for overrides.
- KV bytes = 2 × layers × hidden width × KV ratio × 2 bytes × context × batch. BF16 KV; ideal full sharding. Context matters in decode as well as prefill.
- Footprint = weights × 1.2 + KV. Minimum units = ceil(footprint / capacity); unknown capacity remains unknown. Each unit represents one independent memory domain/package, not another core sharing the same RAM. Counts ignore purchase/configuration/topology constraints.
- Step operations = 2 × active parameters × batch × (1 for decode, prompt tokens for prefill). MoE active fraction reduces work and ideal traffic, not resident total weight capacity. Expert union/routing imbalance and attention FLOPs are omitted.
- Local memory time = (active weights + decode KV read / prefill KV write) / (units × bandwidth × efficiency). Compute time = operations / (units × effective BF16 rate × efficiency).
- If explicit host offload is enabled and supported, evict weights first and stream min(weights per unit, spill) × active fraction through host DDR and PCIe each step. Host capacity must fit the spill per device; local memory must still fit KV + reserve. This is weight-only offload, not arbitrary KV paging. No bus charge for resident steady-state weights; separately display first-load transfer time. Unified-memory systems have no fictitious PCIe copy.
- Idealized tensor parallel ring: 2 collectives per layer; each all-reduce transfers 2 × (N−1)/N × batch × tokens × hidden width × 2 bytes per rank, plus 2 × (N−1) × link latency. Ring time is added to max(local memory, host DDR, bus, compute), i.e. communication does not fully overlap compute. This is a configurable teaching topology, not NCCL/ICI benchmarking or a real Pod deployment recipe.
- Network bandwidth in Gbit/s; convert to GB/s by dividing by 8. An off network with >1 unit blocks execution; one unit has zero collective traffic. Editable network latency and bandwidth apply equally to all profiles to isolate network effects; vendor fabric defaults are not conflated with external network.
- Per-sequence decode tokens/s = 1000 / step ms; aggregate tokens/s = batch × per-sequence rate. Prefill shows prompt-processing tokens/s, never calls it decode speed.
- Capacity calculator reports the exact mathematical fit floor. Target calculator scans 1–1024 units and reports the first feasible modeled target, or 'not reached within 1,024'; network may make more units worse. Results are optimistic estimates, not guarantees of runtime/operator support (especially NPU), usable bandwidth, multi-host support, or an actual 2T deployment.

## Verification
Pure tests: 2T footprint, ceil boundaries, KV/context effects, active versus total params, blocked capacity, host offload bus timing, shared memory, GB/s versus Gbit/s, single-unit zero network, multi-unit disabled network, low-bandwidth/latency network wall, compute wall, unknown capacity, invalid input, target-search failure.
Browser tests: every architecture's unique SVG structure, changed hotspots, manual and automatic sizing, presets/exact input, network and bus scenarios, keyboard controls, reset, selection, error handling, no runtime external requests, all motion pause modes, 360px/768px/desktop overflow, optional Roofline.

## Research
Primary references and retrieved excerpts will be recorded in `docs/research.md`. Key references: Google DeepMind's inference scaling chapter (KV formula, memory/compute bounds and sharding), inference Roofline survey arXiv:2402.16363, Google TPU v6e architecture, NVIDIA DGX B200 specifications, Apple M4 Neural Engine/unified memory. No new third-party runtime dependencies needed.

## Local verification record

- `npm run test:e2e`: **48/48 passed**, including strict application/test type checking and production build.
- `npx playwright test --repeat-each=2`: **96/96 passed** on the final implementation.
- `npm audit --audit-level=moderate`: **0 vulnerabilities**.
- `git diff --check`: clean; source branch matched origin before publication.
- Production bundle: JS 48.47 KB / 16.87 KB gzip; CSS 59.35 KB / 12.80 KB gzip; HTML 26.99 KB / 7.96 KB gzip.
- Reviewed 360px/768px/1440px full-page screenshots and 1600px CPU/GPU/TPU/NPU detail captures. Schematics scroll locally on narrow screens; no document overflow.
- Additional Chromium maximum-workload probe: 2T BF16, batch 32, 8,192-token prefill; no page errors, no validation errors, nine physical maps, 5,414.8 GB estimated working set.
- Reference browser synchronous scenario updates measured roughly 24–36 ms (five-sample probe, including one no-op); this is a local UI observation, not a hardware performance benchmark.
- Screenshot review caught and fixed inherited SVG fills masking memory/systolic cells; regression tests now assert occupied-memory fill and separate host-spill occupancy. Unmodeled cache/buffer timing is gray, not a falsely asserted cache hotspot.
- Publication verification follows the source commit; it is not inferred from local tests.
