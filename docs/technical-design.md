# Technical design — architecture simulation and calculator

**Revision:** October 5, 2026. This supersedes the generic eight-lane map design. The optional normalized Roofline is intentionally independent of the architecture calculator.

## Runtime structure

Vanilla strict TypeScript, native DOM/SVG, Vite static build, no new runtime dependencies. GitHub Pages serves relative local assets. No backend, login, secret, telemetry, remote font, or automatic source retrieval.

- `src/data/models.ts`: six revision-pinned configs/cards/index-derived model presets and pure cache/state sizing; official config snapshots live in `tests/fixtures/model-configs/`.
- `src/visuals/planning.ts`: target-count shortlist, ring-equation bandwidth/latency inversion and explicit manual exploration.
- `src/data/profiles.ts`: nine memory/specification profiles, with source and evidence.
- `src/domain/model.ts`: original normalized Roofline pure model; 1B–2T validation.
- `src/domain/architecture.ts`: pure validated cluster/resource model, generic Transformer shape, math assumptions, blocked states, memory floor, target search.
- `src/visuals/architecture-map.ts`: symbolic architecture-specific SVG, occupied memory banks, controllers, cache/buffer regions, core/Tensor/MXU/MAC/dataflow tiles, peer network, queue dots and packets.
- `src/visuals/silicon-map.ts`: workload receipt, physical lane results, sizing, resource-time bars, explanation and editable assumptions.
- `src/main.ts`: shared form state, profile selection, chip overrides, validation, reset, per-schematic visibility and motion.
- `src/styles.css` + `src/architecture.css`: responsive shell and schematic/control states.

## Model and boundaries

The complete equations and assumptions live in [the implementation plan](architecture-simulation-plan.md#equations-and-explicit-limitations). Important separations:

1. **Capacity** is a feasibility constraint, not a service time. Resident memory = total weights × 1.2 + selected cache/state. Native storage uses checkpoint index bytes; uniform precision is a theoretical repack. See [the current audit](hardware-model-audit.md) for hybrid, sliding, MLA and CSA2 formulas. Counts refer to independent memory domains/packages, never extra cores sharing RAM.
2. **Memory bandwidth** aggregates the local controller/fabric/cache path. Internal cache bandwidth/capacity is not separately modeled; these blocks stay neutral gray with an 'unmodeled' label instead of falsely pinpointing a cache bottleneck. Memory specifications retain vendor/derived/claim evidence.
3. **Bus** is separate from HBM. Resident weights do not cross PCIe per token. Explicit weight offload evicts weights first: active spilled weight bytes = min(weights/unit, spill) × activeWeightTraffic/residentWeights. Uniform traffic uses active fraction; native mixed formats use a conservative BF16 active-weight allowance. Host RAM must hold spill; local KV/reserve must fit. Bus and host DDR time are charged per step; first-load time is separately displayed.
4. **Math** uses editable BF16-equivalent assumptions, except vendor TPU 918 TFLOP/s BF16. Default CPU/Apple/Groq/B200 ceilings are illustrative and separately qualified, not precision-incompatible vendor rankings. Global efficiency discounts math and bandwidth; the normalized reference roof never changes architecture math.
5. **Network** models two tensor-parallel ring all-reduces per layer, payload plus per-hop latency. Gbit/s is converted to decimal GB/s with division by eight. The selected link is a teaching assumption shared across profiles, not a claim about NVLink, ICI, a real Pod, or Ethernet topology.
6. **Step time** = max(memory, host DDR, bus, math) + network. Decode rate is per-sequence next-token rate; prefill rate is per-sequence prompt-processing throughput. Aggregate rate multiplies by batch.
7. **Sizing** reports ceil(working set / unit memory) and searches every integer 1–1,024 for the first feasible target rate. No monotonic scaling assumption. No solution in that range is reported explicitly; unknown required data remains unknown.

The generic default shape derives layer count and hidden width from total parameter count. Named presets fill shape, per-K/V width, released storage, phase-specific active work and cache layout while preserving cluster settings. Precision edits keep the cache layout; shape/KV/active edits switch to custom BF16 GQA. Manual shape, independent KV width, KV ratio and active parameter fraction are exposed. Exact context supports up to 1,048,576 tokens; exceeding a preset config limit is warned, not claimed supported. MoE never reduces total resident weight capacity. Expert union across batches, routing/imbalance, attention FLOPs, kernels, power, deployment/operator support, and actual fabric shape are excluded.

## Visual behavior

Each SVG shows a symbolic topology, not a transistor-accurate die or exact tile count. Red outlines/queues/text mark the constraining resource. Green marks faster stages, not an absolute vendor ranking. Memory-cell occupancy and a numeric capacity ratio separate RAM space from bandwidth. Service-time bars use one shared scale across included architectures; exact labels remain readable for very small bars.

Packets move along actual schematic paths with duration `1.1 + 1.7 × log10(1 + stage_ms)` seconds. This is a common compressed visual scale, not a literal packet clock. Tile busy/wait duty is derived from math time / step time; the cycle duration is similarly log-compressed. Systolic cells show a staggered wave. First-load PCIe is described separately; its wire is not animated as recurring traffic for a resident model. Blocked systems have dim, inactive processing tiles and no moving packets.

There is no JavaScript per-frame simulation/layout loop. Calculation and SVG replacement occur only on input/selection/assumption changes. A scenario signature suppresses duplicate native blur/change rerenders, protecting click targets. Errors retain the last valid visualization, and restoring that scenario clears the error even if its signature matches.

`IntersectionObserver` tracks each schematic, pausing offscreen lanes. User pause, reduced motion and document visibility independently stop motion. Numerical results, labels and hotspots remain available without animation. All labels, inputs, disclosures and profile buttons work with keyboard. Narrow layouts stack cards; only the focusable schematic viewport scrolls horizontally, never the document.

## Data honesty and deployment

The M4 NPU lane uses an M4 Max package memory envelope, not a separate bank or guaranteed NPU-usable capacity. Package bandwidth is an optimistic shared ceiling. Its math assumption is not Apple TOPS. Groq is explicitly first-generation GroqChip 1: published 220 MB SRAM and qualified 55 TB/s aggregate bandwidth; instructions/workspace/compiler placement and current GroqCloud equivalence remain unvalidated.

The hosted application does not contact source URLs. Sources are user-initiated links. No `.env` is needed. CI uses the existing Node 24/Playwright/Pages workflow, building and testing before deployment. Production assets remain relative under `https://macel94.github.io/ai-roofline-lab/`.
