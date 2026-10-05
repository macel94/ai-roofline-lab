# Hardware and model assumptions audit

Audited October 5, 2026. The app ships offline metadata; source pages are never requested at runtime. Manufacturer peaks are attributed specifications/claims, not measurements. **Memory defaults can be checked against specifications; most effective compute defaults cannot be verified as hardware facts.** They remain explicit editable teaching assumptions. Unit/rate results are not validated deployments.

## Nine chip paths

| Profile / unit scope | Capacity and local bandwidth | Matrix ceiling used | Bus and networking evidence / limits |
|---|---|---|---|
| M4 Max GPU, one package | Up to 128 GB / 546 GB/s; Apple vendor maximum | 20 TFLOP/s assumed BF16-equivalent | Shared memory, no PCIe copy. Package contention and engine-specific bandwidth are not known. Multi-package networking is user-assumed. |
| M5 Pro GPU, one package | Up to 64 GB / 307 GB/s; Apple vendor maximum | 15 TFLOP/s assumed BF16-equivalent | Shared SoC fabric. Relative generational AI claims do not establish absolute math throughput. |
| M5 Max GPU, one package | Up to 128 GB / 614 GB/s; Apple vendor maximum | 30 TFLOP/s assumed BF16-equivalent | Same limitation; never multiply an Apple relative AI claim by an unrelated peak. |
| Lion Cove, Core Ultra 9 285K platform | Configured host RAM, default 128 GB; 102.4 GB/s theoretical = two DDR5-6400 channels × 8 bytes | 2 TFLOP/s assumed vector/BF16-equivalent | DDR/controller/cache path aggregated. Intel ARK returned 403 again; retained memory-channel/rate figures are representative, not newly verified. Not every Lion Cove SKU/platform has this bandwidth. |
| Zen 5, Ryzen 9 9950X platform | Configured host RAM, default 128 GB, capped at vendor maximum 256 GB. 89.6 GB/s theoretical = two DDR5-5600 channels × 8 bytes | 4 TFLOP/s assumed vector/BF16-equivalent | AMD confirms two channels, AVX-512, two-DIMM DDR5-5600, four-DIMM DDR5-3600, maximum 256 GB. The default models the two-DIMM speed; capacity alone does not prove that speed. |
| B200, one GPU of DGX B200 | Derived 180 GB and 8,000 GB/s from eight-GPU totals 1,440 GB / 64 TB/s | 2,250 TFLOP/s assumed BF16-equivalent; cited DGX page provides FP4/FP8, not this BF16 default | Assumed PCIe 5 ×16: 32 GT/s × 16 lanes / 8 × 128/130 = 63.015 GB/s one-way encoding ceiling (replaces unencoded 64). TLP/protocol overhead and board topology excluded. NVLink 14.4 TB/s is whole-system aggregate, not one rank's ring throughput. DGX external NICs up to 400 Gbit/s. |
| TPU v6e, one chip | Vendor 32 GB / 1,638 GB/s | Vendor 918 TFLOP/s BF16, then utilization discount | One TensorCore/two MXUs. 800 GB/s ICI is bidirectional aggregate over four ports; actual fabric is a 2D torus. Provisionable chip counts 1,4,8,16,32,64,128,256; arbitrary mathematical counts are not valid slices. |
| M4 Neural Engine, M4 Max package envelope | 128 GB / 546 GB/s **shared package ceiling**, not dedicated NPU memory/bandwidth | 8 TFLOP/s assumed BF16-equivalent; **not** Apple TOPS | No PCIe copy. NPU operator support, buffers and full LLM placement are not verified. Additional units mean packages, not more NPU cores in one shared RAM pool. |
| Groq LPU / **GroqChip 1**, first-generation TSP | Published 220 MB = conservative 0.22 decimal GB; 55 TB/s **aggregate SRAM claim**, Hot Chips 34 slide 22 | 100 TFLOP/s assumed FP16-equivalent; not conversion from ~750 INT8 TOPS or evidence of BF16 support | Same vendor talk also describes 80 TB/s aggregate concurrency and 480 GB/s aggregate networking. These do not establish sustained weight-read or per-rank ring bandwidth. Programs/workspace share SRAM. Custom compiler-scheduled Dragonfly is not a tensor-parallel ring. **Not a current GroqCloud hardware specification.** |

### Hardware sources

- [Apple M4 Pro / Max](https://www.apple.com/newsroom/2024/10/apple-introduces-m4-pro-and-m4-max/)
- [Apple M5 Pro / Max](https://www.apple.com/newsroom/2026/03/apple-debuts-m5-pro-and-m5-max-to-supercharge-the-most-demanding-pro-workflows/)
- [Intel ARK Core Ultra 9 285K](https://www.intel.com/content/www/us/en/products/sku/241061/intel-core-ultra-9-processor-285k-36m-cache-up-to-5-70-ghz/specifications.html) — retrieval blocked; qualification retained.
- [AMD Ryzen 9 9950X](https://www.amd.com/en/products/processors/desktops/ryzen/9000-series/amd-ryzen-9-9950x.html)
- [NVIDIA DGX B200](https://www.nvidia.com/en-us/data-center/dgx-b200/) and its [official datasheet](https://dam-cdn.nvd.orangelogic.com/AssetLink/h226p7256j0xwmhmx4qqc1t3dv4jqg2m.pdf): both reconfirm memory/system network and FP4/FP8 sparse/dense scope; neither establishes the BF16 teaching default.
- [Google TPU v6e](https://docs.cloud.google.com/tpu/docs/v6e)
- [Groq Hot Chips 34, 2022 PDF](https://hc34.hotchips.org/assets/program/conference/day2/Machine%20Learning/HotChips34%20-%20Groq%20-%20Abts%20-%20final.pdf), especially slides 16, 22, 26, 28 and 30.

Global defaults remain assumptions: 70% utilization, 20 tokens/s/sequence target, 400 Gbit/s usable one-way/rank, 2 µs/hop, and 20% weight reserve. GPU offload host DDR uses a 102.4 GB/s reference, not measured DGX bandwidth. All capacities/storage are decimal GB. Native checkpoint indexes already contain quantization tensors/scales; the additional reserve is generic runtime headroom, not another claimed quantization size.

## Six open-weight presets

“Open-weight” is deliberate: availability of weights does not make every license unrestricted open source. Gemma license applies to Gemma. Model licenses/runtime requirements must be checked separately.

| Preset | Resident metadata count | Released tensor bytes, decimal GB | Format | Text layers / hidden | Active B/token (decode / prefill) | Cache shape |
|---|---:|---:|---|---|---|---|
| Qwen3.8-27B | 27.781427952B | 55.562855904 | BF16 | 64 / 5120 | 27.7814 / 27.7814, conservative full-checkpoint dense estimate | Only 16 full-attention layers; 4 KV heads × 256 = width 1024 **per K or V**. 48 recurrent layers. |
| DeepSeek V4.1 Flash | 763.205315794B HF checkpoint metadata | 510.286023 | FP4 experts + FP8/BF16/FP32 mixed tensors | 40 / 5120 | **16 / 8**, model-card figures | CSA2 shared latent width 512, compressed shared sources and index keys: **890 global bytes/token**. |
| Qwen3-30B-A3B | 30.532122624B | 61.064245248 | BF16 | 48 / 2048 | 3.3 / 3.3, rounded card figure | Four KV heads × 128 = width 512; all 48 layers full attention. |
| GPT-OSS-120B | 116.829156672B HF metadata | 65.248815744 | MXFP4 experts, BF16 exclusions | 36 / 2880 | 5.1 / 5.1, rounded card figure | Eight KV heads × 64 = width 512; 18 full + 18 sliding layers, window 128. |
| Gemma 4 31B IT | 31.273088876B | 62.546177752 | BF16 | 60 / 5376 | 31.2731 / 31.2731, conservative full-checkpoint dense estimate | 10 global layers: 4 × 512 = 2048; 50 local layers: 16 × 256 = 4096, window 1024. |
| Mistral Small 4 119B | 119.401317952B | 120.92277056 | FP8, BF16 exclusions | 36 / 4096 | 6.5 / 6.5, rounded card figure | MLA: one shared latent rank 256 + rotary width 64 = **320**, not a pair of width-4096 GQA caches. |

### Pinned official repositories

Each link contains config, card and checkpoint index. Config snapshots in `tests/fixtures/model-configs/` were retrieved from these exact revisions and matched the audited configs. `src/data/models.ts` stores the revision and compact derived data.

- [Qwen/Qwen3.8-27B @ 1d4bf0f](https://huggingface.co/Qwen/Qwen3.8-27B/tree/1d4bf0f2ff6012fd82039f2fa52739d0dd7c60c0)
- [deepseek-ai/DeepSeek-V4.1-Flash @ 2cba9e4](https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/tree/2cba9e42aa026125f3ed06c6d98c1db82f7ca027)
- [Qwen/Qwen3-30B-A3B @ ad44e77](https://huggingface.co/Qwen/Qwen3-30B-A3B/tree/ad44e777bcd18fa416d9da3bd8f70d33ebb85d39)
- [openai/gpt-oss-120b @ b5c939d](https://huggingface.co/openai/gpt-oss-120b/tree/b5c939de8f754692c1647ca79fbf85e8c1e70f8a)
- [google/gemma-4-31B-it @ 842da37](https://huggingface.co/google/gemma-4-31B-it/tree/842da3794eaa0b77d5f08bae87a17459d91ff475)
- [mistralai/Mistral-Small-4-119B-2603 @ a11f36b](https://huggingface.co/mistralai/Mistral-Small-4-119B-2603/tree/a11f36bebf709121056b1dbcc943d1c6afbe494d)

### Storage verification

Fetched official `model.safetensors.index.json` and Hugging Face model/tree metadata. Summed the sizes of exactly the shard files listed by each index (no pagination/missing files). File totals, including headers, were respectively 55,563,006,776; 510,296,708,312; 61,066,575,648; 65,248,893,184; 62,546,338,248; and 120,922,973,936 bytes. They agree with tensor totals to small file-header differences. No full model weights were downloaded. Native storage uses index tensor bytes, not file headers, tokenizer files, or a uniform precision inferred from `dtype`.

DeepSeek has 552B backbone + 196B sparsely accessed Engram plus auxiliary checkpoint tensors. The 763B checkpoint count must **not** become dense compute. Packed FP4 metadata is not a universal precision declaration. Its released checkpoint is ~510 GB, not 381.6 GB from blindly assuming Q4, nor 763 GB from assuming Q8.

DeepSeek-R1-0528 was researched but not shipped: its index reported 1,369,062,772,000 bytes while listed shard files totaled 688,586,727,753 bytes. Its mixed FP8 config/metadata and index disagree materially. Llama-3.3-70B official config retrieval was gated; the NVIDIA mirror was read, but no native-storage preset was shipped from unverified original checkpoint bytes.

## Cache, traffic and work equations

For BF16 full/sliding caches:

`bytes = 2 K/V copies × 2 bytes × batch × (fullLayers × fullWidth × context + slidingLayers × slidingWidth × min(context, window)) + recurrent/state allowance × batch`.

- **Qwen hybrid:** full-attention term uses only 16 layers. Recurrent allowance uses 48 × (48 value heads × 128 key width × 128 value width × 4 FP32 bytes + (2 × 16 key heads × 128 + 48 value heads × 128) × 4 convolution slots × 2 BF16 bytes). Convolution allocation is a conservative four-slot allowance; implementations can retain fewer slots. Runtime dtype/preallocation is not universal.
- **Gemma:** `attention_k_eq_v` shares projections, but this conservative cache retains both BF16 runtime buffers. Global/local dimensions are not interchangeable. No KV-sharing layers are configured.
- **Mistral MLA:** one BF16 latent of width 320/layer; an expanded-cache runtime can consume substantially more. Native weight FP8 does not imply FP8 KV.
- **DeepSeek:** global main KV: (3 half-rate sources + 1 full-rate source) × 512 × (0.5 FP4 + 1/16 scale byte) = 720 bytes/token. Shared index keys: 2.5 × 128 × (0.5 FP4 + 1/32 scale byte) = 170. Sum **890**. Add 40 × 128 × (512 + 512/32) bytes for FP8 window/scales, plus three compression sources × two FP32 pooling buffers × two slots × 512 × four bytes. Packed cache is an optimized storage assumption; the readable reference implementation stores some quantized values in larger BF16-shaped buffers. SWA replay, scratch tensors, speculative draft caches and indexer execution workspace are excluded.
- Caches are ideally sharded. Real head count/divisibility, replicated caches, page rounding and runtime allocation can require more memory. Shared/sparse read patterns are not simulated; traffic charges resident cache/state once per step.

Work: `2 × activeParametersBillion × batch × tokensPerStep` GFLOP. Decode uses one token; prefill uses prompt length. Dense presets conservatively use full checkpoint count, including vision tensors, because no audited text-only active count is published here. Image computation is not simulated. Card active counts are rounded. DeepSeek phase counts are automatic and cannot silently remain 16B after switching to prefill.

Uniform storage is a **theoretical repack**: `totalParametersBillion × bits/8` GB, not a promise that a checkpoint/runtime supports the quantization. Native mixed-format weight traffic uses `min(nativeWeightsGB, activeParametersBillion × 2)` GB, a conservative BF16 active-weight allowance. It is not a per-tensor exact read count, a low-bit math claim, or an expert-union model. Uniform traffic uses weights × active fraction. Offload applies the same traffic/resident ratio to spilled weights. Resident capacity never scales by active fraction.

## Target guidance

The shortlist uses the existing bounded, nonmonotonic search through 1–1,024 units, not linear scaling. It sorts by mathematical target count, not cost, energy, availability, or validated software support. Disclosures show per-unit memory/headroom, bandwidth, host bus, and network requirements; an explicit button applies the count to manual exploration.

At a candidate count, solve the **same** two-all-reduces/layer ring equation for required usable Gbit/s and maximum hop latency given target time minus local service time. This is an optimistic teaching ring with BF16-sized activation payloads. DeepSeek CED/mHC/Engram, expert all-to-all, indexing collectives, compiler schedules, pipeline partitioning, actual switches and legal model-parallel degrees are not represented. Network figures must not be used as a deployment fabric prescription.

Preset selection preserves phase, batch, context, target, units, fabric, utilization, host offload/RAM and chip overrides. Precision edits retain sourced cache layout but label a theoretical repack. Shape/KV/active edits detach the preset and return to custom BF16 GQA; stale hybrid cache rules cannot survive. Context beyond the config limit is warned, not claimed supported.

## Verification

Production build, final **80 tests repeated twice (160/160)**, dependency audit (0 vulnerabilities), config-fixture checks and desktop/mobile review passed. Impeccable's final detector returned no findings. Details and evidence boundaries are recorded in [the delivery plan](model-hardware-audit-plan.md). No runtime dependency was added. Changes remain local; no commit/push/deployment was performed.
