# Product specification — physical architecture simulation

**Version:** 0.5 · October 5, 2026. Supersedes the generic map's eight-profile/shared-math requirements.

## Goal

Visually answer **where and why an AI model is slow**: memory space, memory/controller bandwidth, the host bus, processing tiles, or the network. Also estimate independent units needed to fit a model and reach a target rate, through **2 trillion total parameters**.

The product is a static, unauthenticated educational resource simulator, not an LLM runtime, hardware benchmark, or guaranteed deployment planner.

## User stories and acceptance

| Story | Acceptance |
|---|---|
| See each processing type's physical architecture | Distinct CPU DDR/controller/L3/core, GPU PCIe/HBM/L2/Tensor, TPU buffer/two-MXU, NPU unified-fabric/SRAM/MAC, and LPU SRAM/dataflow schematics. Memory and network have physical positions, not only lines in a performance graph. |
| See where a model is slower/faster | Per-resource service times, shared-scale bars, red bottleneck component/text/queues, green faster stages, workload-driven packet speed and tile duty. Capacity overflow is blocked, not labeled fast. |
| Size a very large model | Range and exact input accept 1–2,000 billion parameters; 7B/70B/405B/1T/2T presets. Total resident weights include all MoE experts. |
| Calculate how many units are needed | Auto memory floor, manual counts, and first feasible target rate across 1–1,024 independent memory domains. Unknown capacity remains unknown; unreached targets are explicit. |
| Understand network impact | Configurable Gbit/s and hop latency; one unit has zero collectives, a disconnected multi-unit model is blocked, high latency can make additional units slower. |
| Understand host-bus costs | Resident GPU weights incur no recurring PCIe traffic. Explicit offload charges DDR/PCIe and checks host/local KV capacity. UMA paths do not invent a PCIe copy. |
| Configure real model metadata | Six sourced open-weight presets fill storage, layers/hidden/KV width, active work and cache layout. Custom shape/KV width, batch/context, precision and active fraction remain editable. Native mixed formats and theoretical repacks are distinguished. |
| Review assumptions | Sourced memory facts, separate vendor TPU BF16 peak and illustrative math ceilings, per-chip math/capacity overrides, source links and explicit scope limitations. |
| Use keyboard/mobile/reduced motion | Focusable controls/SVG scroll areas, accessible names, non-color bottleneck labels, 360px–desktop without document overflow, pause/hidden/offscreen/reduced-motion handling. |

Each story is bounded, independently testable against the pure model, valuable to learners and ML engineers, and leaves exact visual styling negotiable.

## Requirements

- On load, all nine profiles are included: M4 Max GPU, M5 Pro GPU, M5 Max GPU, Lion Cove CPU, Zen 5 CPU, B200 GPU, TPU v6e, M4 Neural Engine NPU, Groq LPU.
- Shared controls appear before the long schematic list. Every selected architecture receives identical workload/network assumptions; each chip uses a separately qualified math ceiling.
- Toggling inclusion only changes that architecture's technical comparison and active scaling context. Excluded physical schematics remain visible and dimmed, without motion. Clear/select-all/reset have explicit behavior.
- Defaults: 7B Q4, batch 1, decode, context 512, host/CPU RAM 128 GB, inferred shape/GQA ratio 1/8, active fraction 100%, auto memory fit, 400 Gbit/s, 2 µs hop latency, 70% efficiency, target 20 tokens/s per sequence.
- Named presets preserve phase/batch/context/target/cluster settings; shape/KV/active edits detach sourced special-cache rules. DeepSeek V4.1 uses 8B active prefill / 16B decode. Context beyond config limits is warned.
- A target shortlist reports modeled counts, memory/bus/fabric conditions and supports explicit manual exploration; it does not rank price or validate runtime support.
- Groq is a published first-generation reference, not current GroqCloud hardware. Intel representative memory figures remain qualified after blocked retrieval.
- Capacity includes weights × 1.2 + selected cache/state. Counts mean independently provisioned memory domains, not cores in a shared pool.
- If execution is infeasible, show the cause and no throughput. If a required hardware value is unpublished, preserve unknown rather than silently inventing it.
- Decode and prefill must visibly change work and bottleneck placement; prefill token rates must be labeled prompt processing, not generated-token speed.
- Quantized weight storage must not imply quantized arithmetic. Illustrative math defaults and user overrides must not be presented as manufacturer facts.
- Invalid/empty/out-of-range inputs must produce an actionable inline error and retain the last valid visualization. Recovery and reset must clear errors.
- Motion must never be the only data encoding. Stop blocked/excluded tiles and packets; pause unseen schematics, hidden documents, user-paused mode, and reduced-motion mode.
- The independent normalized Roofline chart/table remains optional and is explicitly not the architecture calculator.
- No backend, account, credentials, API, telemetry, remote runtime assets, or automatic source fetching.

## Explicit non-goals

No measured latency/energy/cost, deployment runtime validation, NPU operator guarantee, exact transistor/core layout, internal-cache roof modeling, real ICI/NVLink topology emulation, automatic model metadata fetch, attention FLOP accounting, MoE routing/imbalance, or measured vendor ranking. Counts and rates are assumption-based resource estimates.

## Definition of done

- [x] Research and a Markdown implementation plan with equations/limitations.
- [x] Distinct physical architecture schematics and resource-driven hotspots/motion.
- [x] 2T workload range, network, KV/MoE, offload, per-chip overrides and unit/target calculator.
- [x] Strict build and all numerical/browser tests pass repeatedly; screenshots reviewed.
- [x] Historical architecture/design deliveries were committed, pushed and live-verified.
- [ ] This model-preset revision requires user-authorized publication before claiming it is live.
