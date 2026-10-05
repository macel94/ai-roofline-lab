# AI Silicon / Roofline Lab

A static TypeScript architecture simulator and model-sizing calculator for CPU, GPU, TPU, NPU, and LPU systems, from **1 billion to 2 trillion parameters**.

**Live demo:** [macel94.github.io/ai-roofline-lab](https://macel94.github.io/ai-roofline-lab/)

**Source:** [github.com/macel94/ai-roofline-lab](https://github.com/macel94/ai-roofline-lab)

Nine architecture lanes show symbolic physical layouts: CPU DIMMs/controllers/caches/cores, discrete GPU host RAM/PCIe/HBM/Tensor tiles, TPU buffers/systolic arrays, shared-memory GPU/NPU paths, and Groq SRAM/dataflow. Red hotspots locate RAM-space, memory-bandwidth, bus, compute, or network limits; occupancy blocks, queues, moving packets, and tile activity explain why.

Six revision-pinned open-weight presets include **Qwen3.8-27B**, **DeepSeek V4.1 Flash**, Qwen3-30B-A3B, GPT-OSS-120B, Gemma 4 31B, and Mistral Small 4. Selecting a model fills released checkpoint storage, shape, active work, and hybrid/sliding/MLA/CSA2 cache layout while retaining cluster settings. Uniform Q4/Q8/BF16 options remain theoretical repacks. A target shortlist explains memory, bus and network requirements and lets you explore its modeled unit count.

The calculator includes model-aware cache/state sizing, model shape/MoE controls, configurable network bandwidth and hop latency, manual or minimum-fit unit allocation, explicit GPU weight offload, and a target tokens/s search up to 1,024 independent memory domains. Per-chip capacity/math assumptions can be edited. Unknown capacity stays unknown; blocked configurations never get throughput claims. More units can be slower when network latency dominates.

**These are optimistic resource estimates, not benchmarks or validated deployments.** Most effective matrix ceilings are explicitly illustrative assumptions; the TPU BF16 peak is vendor-reported. Q4 storage does not imply Q4 arithmetic. Schematics are symbolic, cache/fabric bandwidth is aggregated, and actual runtime/operator support (especially NPU), attention compute, expert routing, and real topology are not validated. A separate normalized Roofline remains available as an optional teaching lens.

Groq is retained as a **published first-generation GroqChip 1** reference: 220 MB SRAM and a qualified 55 TB/s aggregate claim, not current GroqCloud hardware. Intel ARK retrieval was blocked; representative DDR bandwidth stays qualified. See the [complete hardware/model audit](docs/hardware-model-audit.md), including every sourced value, assumption, checkpoint revision and omitted cost.

The site requires no account, backend, API key, or runtime network service. Source links are optional and open only when clicked.

## Run locally

```sh
npm ci
npm run dev
```

Open the local Vite URL shown in the terminal. One-time local E2E setup:

```sh
npx playwright install chromium
npm run typecheck
npm run test:e2e
```

`npm run test:e2e` builds `dist/` and runs Playwright against the static output served with `vite preview`.

## Design tooling

Impeccable is installed project-locally in [`.pi/skills/impeccable`](.pi/skills/impeccable/SKILL.md), using the official `npx impeccable@4.1.0 install --providers=pi --scope=project` installer. The skill guidance and launchers are tracked; downloaded platform engines are ignored. Reload Pi to discover `/impeccable polish`, `distill`, `animate`, `colorize`, and `delight`.

Run the installed detector with:

```sh
.pi/skills/impeccable/scripts/impeccable detect --json index.html src/styles.css src/architecture.css src/visuals
```

The launcher pins its engine version and checksum-verifies downloads. This is development tooling, not a website dependency. Fonts are self-hosted under `public/fonts` with their license; the site makes no runtime external font requests. See [the readability and polish plan](docs/design-polish-plan.md).

## Project documentation

- [Model/hardware audit delivery plan](docs/model-hardware-audit-plan.md)
- [Audited defaults, model sources and cache equations](docs/hardware-model-audit.md)
- [Implementation plan, equations, and verification](docs/architecture-simulation-plan.md)
- [Product specification and acceptance criteria](docs/specification.md)
- [Technical design and model](docs/technical-design.md)
- [Research, sources, and data qualifications](docs/research.md)
- [Test and deployment plan](docs/test-plan.md)
- [Decision log and parallel reviews](docs/decision-log.md)

The architecture-calculator revision responds to feedback that a generic graph did not locate bottlenecks within the physical hardware.
