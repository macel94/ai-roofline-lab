# Research, Sources, and Data Qualifications

**Research date:** October 4, 2026. Manufacturer specifications are attributed claims, not independent measurements. Product pages may change; the simulator does not fetch data at runtime.

**Current model/chip audit:** [hardware-model-audit.md](hardware-model-audit.md) records six revision-pinned models, shard-size verification, model-aware cache layouts and all nine chip defaults. It supersedes the earlier unnamed Groq capacity/bandwidth assumptions and unencoded PCIe ceiling.

## 1. Roofline model

- **Samuel Williams, Andrew Waterman, David Patterson — “Roofline: An Insightful Visual Performance Model for Multicore Architectures”** (UC Berkeley EECS-2008-134; CACM 2009). [Berkeley PDF](https://www2.eecs.berkeley.edu/Pubs/TechRpts/2008/Archive/EECS-2008-134.pdf) · [ACM record](https://dl.acm.org/doi/10.1145/1498765.1498785)
- The paper defines operational intensity as operations per byte of main-memory traffic after cache filtering and the Roofline upper bound as `min(peak compute, peak bandwidth × operational intensity)`. This simulator simplifies the memory hierarchy and explicitly names the level used by each profile.

## 2. Hardware sources

### Apple silicon

- [Apple — M4 Pro and M4 Max](https://www.apple.com/newsroom/2024/10/apple-introduces-m4-pro-and-m4-max/): M4 Max up to 128 GB unified memory and 546 GB/s; M4 Pro up to 64 GB and 273 GB/s. Apple describes unified memory and Neural Engine/ML accelerators.
- [Apple — M5 Pro and M5 Max](https://www.apple.com/newsroom/2026/03/apple-debuts-m5-pro-and-m5-max-to-supercharge-the-most-demanding-pro-workflows/): M5 Pro up to 64 GB and 307 GB/s; M5 Max up to 128 GB and 614 GB/s; Neural Accelerator in each GPU core. AI performance statements are generational comparisons, not a common absolute FP16/BF16 peak.
- [Apple — Mac Studio with M5 Max and M5 Ultra](https://www.apple.com/newsroom/2026/08/apple-introduces-new-mac-studio-with-m5-max-and-m5-ultra/): confirms M5 Max bandwidth and distinguishes the Ultra configuration.

**Decision:** show M4 Max, M5 Pro, and M5 Max independently. Capacity is labeled “up to”; do not apply one Apple bandwidth to every SoC.

### Intel x86

- [Intel ARK — Core Ultra 9 285K](https://www.intel.com/content/www/us/en/products/sku/241061/intel-core-ultra-9-processor-285k-36m-cache-up-to-5-70-ghz/specifications.html)
- [Intel — Core Ultra 200S desktop press kit](https://www.intel.com/content/www/us/en/newsroom/resources/press-kit-core-ultra-desktop-processors-series-2.html)

Intel’s page rejected automated retrieval during this research session. The profile is therefore **representative and derived**: two channels × DDR5-6400 × 8 bytes = 102.4 GB/s theoretical. It is not measured and is not universal to Lion Cove. Detailed ROB/cache/decoder/port claims from the source brief are excluded unless tied to an accessible primary document and exact SKU.

### AMD x86

- [AMD — Ryzen 9 9950X](https://www.amd.com/en/products/processors/desktops/ryzen/9000-series/amd-ryzen-9-9950x.html): Zen 5, 16 cores, DDR5, AVX-512, maximum memory speed up to DDR5-5600 in the listed two-DIMM configuration; platform capacity varies.
- [AMD — Zen 5 Ryzen 9000 launch](https://www.amd.com/en/newsroom/press-releases/2024-6-2-amd-unveils-next-gen-zen-5-ryzen-processors-to-p.html): generation context and AMD performance claims.

**Derived bandwidth:** two channels × DDR5-5600 × 8 bytes = 89.6 GB/s theoretical. Sustained bandwidth depends on memory/platform/workload; this is not a measurement.

### NVIDIA Blackwell B200

- [NVIDIA — DGX B200](https://www.nvidia.com/en-us/data-center/dgx-b200/): eight GPUs, 1,440 GB total GPU memory, 64 TB/s total HBM3e bandwidth, and precision-/sparsity-qualified compute figures.
- **Per-GPU derivation:** 1,440/8 = 180 GB; 64/8 = 8 TB/s. NVIDIA lists 72 PFLOP/s FP4 dense for the eight-GPU system, so 9 PFLOP/s per GPU for that stated configuration/format. The simulator labels these values as derived and does not use the FP4 peak in the normalized chart.
- The supplied article stated 192 GB per B200. The consulted DGX page implies 180 GB/GPU for the published eight-GPU system; the simulator uses that system context and does not generalize it to every Blackwell SKU.

### Google TPU

- [Google Cloud — TPU v6e / Trillium](https://docs.cloud.google.com/tpu/docs/v6e): per chip, 918 TFLOP/s BF16, 1,836 TOPS INT8, 32 GB HBM, 1,638 GB/s HBM, 800 GB/s bidirectional ICI, and a 256-chip Pod. BF16 and INT8 are not interchangeable.
- [Google Cloud — TPU architecture](https://docs.cloud.google.com/tpu/docs/system-architecture-tpu-vm): describes MXUs/systolic arrays; v6e uses 256×256 arrays with BF16 multiplication and FP32 accumulation. A chip, slice, and Pod are distinct scopes.

### Groq LPU

- [Groq — What is a Language Processing Unit?](https://groq.com/lpu/): manufacturer description of a programmable assembly-line architecture, software-controlled deterministic scheduling, inter-chip streaming, and on-chip SRAM. Groq claims “upwards of 80 terabytes/second” SRAM bandwidth and compares it with GPU HBM.
- The initial generic source did not state capacity. The current profile instead pins **GroqChip 1**, using [Groq Hot Chips 34 (2022)](https://hc34.hotchips.org/assets/program/conference/day2/Machine%20Learning/HotChips34%20-%20Groq%20-%20Abts%20-%20final.pdf) slide 22: 220 MB SRAM and a qualified 55 TB/s aggregate claim. Slide 16 lists 80 TB/s aggregate concurrency and 480 GB/s aggregate networking; these are not sustained per-rank rates. This older generation must not be generalized to current GroqCloud hardware.
- “Up to 10×” remains a manufacturer claim, not a simulated result or ranking.
- The brief’s alleged Groq/NVIDIA acquisition is out of scope and is not repeated without a current primary corporate source.

## 3. Toolchain and deployment references

- [Vite — Deploying a Static Site](https://vite.dev/guide/static-deploy): `dist` output, local `vite preview`, and the GitHub Pages repository-subpath `base` requirement.
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html): TypeScript as a static type checker; run `tsc --noEmit` separately from bundling.
- [Playwright — TypeScript](https://playwright.dev/docs/test-typescript): Playwright transforms TypeScript tests but does not type-check them; run the TypeScript compiler separately.
- [Playwright — Web server](https://playwright.dev/docs/test-webserver): `webServer` and `baseURL` for local test servers. The project tests the production build using `vite preview`.
- [GitHub Docs — Custom workflows with Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages): GitHub Pages is free for public repositories on GitHub Free; workflows need Pages and OIDC permissions.
- Official Actions release records verified against GitHub’s API and action metadata: [checkout v7.0.1](https://github.com/actions/checkout/releases/tag/v7.0.1), [setup-node v7.0.0](https://github.com/actions/setup-node/releases/tag/v7.0.0), [configure-pages v6.0.0](https://github.com/actions/configure-pages/releases/tag/v6.0.0), [upload-pages-artifact v5.0.0](https://github.com/actions/upload-pages-artifact/releases/tag/v5.0.0), and [deploy-pages v5.0.1](https://github.com/actions/deploy-pages/releases/tag/v5.0.1). The JavaScript actions declare Node 24; the upload action is composite.
- npm metadata checked October 4, 2026: Vite 8.3.2 (Node `^20.19.0 || >=22.12.0`), TypeScript 7.0.2 (Node `>=16.20.0`), and `@playwright/test` 1.63.0 (Node `>=20`). Local Node 24.19.0 satisfies the requirements.

## 4. Claims omitted or qualified

| Source-brief claim | Treatment |
|---|---|
| Groq SRAM bandwidth of 150 TB/s | Not used as fact; the consulted Groq page says “upwards of 80 TB/s.” |
| 192 GB per B200 | Not generalized; the DGX B200 total implies 180 GB/GPU in that published system. |
| FP4, BF16, INT8, FP16 peaks as one leaderboard | Not compared; precision, dense/sparse mode, chip/system scope, and units stay explicit. |
| M5 Pro and M5 Max | Updated from current Apple pages: 307 GB/s/64 GB and 614 GB/s/128 GB, respectively. |
| Exact Lion Cove/Skymont ROB, cache, decoder, and execution-port values | Not shown as verified facts without a specific primary source and SKU. |
| Apple AMX register details and performance | Not used in the Roofline; public documentation is not homogeneous or comparable for this demo. |
| Vendor “6×”/“10×” or acquisition claims | Not used to calculate performance; require current sources, test conditions, and a clearly labeled claim. |

## 5. Data update rule

When a hardware figure changes, check the primary source, record date and configuration, update the evidence label/source/test fixture, re-check unit conversions, and only then update the profile. If evidence or scope is insufficient, preserve `unknown` instead of silently estimating.

## 6. Physical architecture / 2T calculator research — October 5, 2026

Searches: DuckDuckGo HTML queries for inference Roofline/memory/tensor-parallel bottlenecks and TypeScript/SVG/Playwright motion testing. The following relevant primary pages were retrieved and read; linked inference/sharding and TPU architecture references were followed. No runtime library was added.

- [Google DeepMind scaling book — inference](https://jax-ml.github.io/scaling-book/inference/): distinguishes prefill and generation, KV key/value storage, compute versus HBM time, model parallelism and the latency/throughput tradeoff. Its KV formula scales with layers × KV heads × head width × sequence × batch; the calculator exposes KV width ratio and assumes BF16/full sharding. Its dense model equations motivate the generic `P ≈ 12 L H²` shape approximation, which is an assumption, not metadata.
- [Scaling book — sharding/collectives](https://jax-ml.github.io/scaling-book/sharding/): communication payload and hop latency matter independently; more parallelism can enter a latency-bound regime. The demo uses an explicitly simplified configurable ring with two collectives/layer, not a measured ICI topology or runtime implementation.
- [LLM Inference Unveiled: Survey and Roofline Model Insights](https://arxiv.org/html/2402.16363v5): decode commonly memory-bound, prefill matrix layers compute-bound, attention can remain memory-bound; weight-only quantization does not automatically permit low-bit compute. Attention FLOPs and layer-by-layer kernel behavior are not included in the calculator's approximation.
- [Google TPU v6e](https://docs.cloud.google.com/tpu/docs/v6e) and [TPU architecture](https://docs.cloud.google.com/tpu/docs/system-architecture-tpu-vm): v6e has one TensorCore containing **two MXUs**, vector/scalar units, 918 TFLOP/s BF16, 32 GB HBM, 1,638 GB/s HBM and 800 GB/s bidirectional ICI per chip. Corrected the old one-MXU summary. Vendor ICI bandwidth is not interchangeable with selectable external/ring network bandwidth.
- [NVIDIA DGX B200](https://www.nvidia.com/en-us/data-center/dgx-b200/): reconfirmed eight GPUs, 1,440 GB memory, 64 TB/s HBM3e, 14.4 TB/s aggregate NVLink and precision-qualified FP4/FP8 system claims. The **2,250 TFLOP/s BF16 teaching default is an explicit illustrative assumption**, not derived from that page's FP4 number. It is editable. Per-GPU memory remains 180 GB / 8 TB/s in this system context.
- [NVIDIA H100](https://www.nvidia.com/en-us/data-center/h100/): separately lists GPU memory bandwidth, NVLink and PCIe; its PCIe Gen5 figure is aggregate/bidirectional. The original demo used an **assumed unencoded 64 GB/s one-way PCIe ×16 ceiling**; the audited revision uses **63.015 GB/s** after 128/130 encoding (protocol overhead excluded), not HBM bandwidth, discounted by efficiency. Host DDR's 102.4 GB/s is a configurable-system reference assumption, not a sourced DGX sustained rate.
- [Google TPU v5p](https://cloud.google.com/tpu/docs/v5p): per-chip HBM/ICI/DCN specifications distinguish memory, internal fabric, and data-center network scopes; actual slices have topology/configuration constraints omitted from the demo.
- [Apple M4](https://www.apple.com/newsroom/2024/05/apple-introduces-m4-chip/): describes a 16-core dedicated Neural Engine and its TOPS claim, alongside CPU/GPU/shared memory. This does **not** establish a comparable BF16 LLM rate. The NPU lane uses the existing M4 Max package's 128 GB / 546 GB/s shared memory envelope and an explicitly assumed 8 TFLOP/s effective matrix ceiling, with operator/buffer support unvalidated.
- [MDN CSS offset-path](https://developer.mozilla.org/en-US/docs/Web/CSS/offset-path): CSS paths in SVG coordinates with `offset-distance` animate packet positions without a JavaScript frame loop. [SVG animateMotion](https://developer.mozilla.org/en-US/docs/Web/SVG/Element/animateMotion) was reviewed; CSS motion was preferred for explicit pause and reduced-motion control.
- [Playwright TypeScript](https://playwright.dev/docs/test-typescript), [assertions](https://playwright.dev/docs/test-assertions), and [emulation](https://playwright.dev/docs/emulation): strict type checking remains separate from test transformation; locator assertions and media emulation verify motion/interaction states against the production build.

### New evidence boundaries

CPU/Apple/Groq and B200 effective math defaults are **illustrative assumptions**; only the TPU math default is the cited vendor BF16 peak. Global efficiency is also an assumption. Assumptions are always identified beside each speed and editable per chip. Cache/controller/fabric shapes are schematic and their bandwidth is aggregated from the memory ceiling. The NPU package memory envelope is not a guaranteed NPU-usable bank. Groq now uses the first-generation published 220 MB SRAM envelope, with programs/workspace/compiler placement and modern-generation equivalence unvalidated. Target unit counts ignore actual topology granularity, head-sharding constraints and runtime feasibility. See [the implementation plan](architecture-simulation-plan.md) for every equation and omitted effect.
