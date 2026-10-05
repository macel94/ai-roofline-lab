import type { WorkloadPhase } from "../domain/model";

export interface ModelPreset {
  id: string;
  name: string;
  repository: string;
  revision: string;
  paramsBillion: number;
  nativeWeightsGB: number;
  nativeFormat: string;
  weightBits: 4 | 8 | 16;
  layers: number;
  hiddenWidth: number;
  maxContextTokens: number;
  kvWidth: number; // per K or V; MLA uses one shared latent instead
  activeBillion: Record<WorkloadPhase, number>;
  cache: {
    fullLayers: number;
    fullWidth: number;
    slidingLayers?: number;
    slidingWidth?: number;
    window?: number;
    // Counts both K and V unless the architecture caches a single latent.
    copies?: number;
    stateBytes?: number;
    compressedBytesPerToken?: number;
  };
  cacheLabel: string;
  notes: string;
}

// Offline snapshots of official configs/cards/indexes. See docs/hardware-model-audit.md.
export const MODEL_PRESETS: readonly ModelPreset[] = [
  {
    id: "qwen38-27b", name: "Qwen3.8-27B", repository: "Qwen/Qwen3.8-27B",
    revision: "1d4bf0f2ff6012fd82039f2fa52739d0dd7c60c0",
    paramsBillion: 27.781427952, nativeWeightsGB: 55.562855904,
    nativeFormat: "BF16", weightBits: 16, layers: 64, hiddenWidth: 5120, maxContextTokens: 262144, kvWidth: 1024,
    activeBillion: { decode: 27.781427952, prefill: 27.781427952 },
    cache: { fullLayers: 16, fullWidth: 1024,
      stateBytes: 48 * (48 * 128 * 128 * 4 + (2 * 16 * 128 + 48 * 128) * 4 * 2) },
    cacheLabel: "16 full-attention layers · K/V width 1,024 each · 48 recurrent layers",
    notes: "BF16 full-attention KV plus FP32 recurrent matrices and BF16 convolution state. Dense work conservatively counts the full checkpoint, including vision weights; image processing and MTP are excluded.",
  },
  {
    id: "deepseek-v41-flash", name: "DeepSeek V4.1 Flash · 763B checkpoint",
    repository: "deepseek-ai/DeepSeek-V4.1-Flash", revision: "2cba9e42aa026125f3ed06c6d98c1db82f7ca027",
    paramsBillion: 763.205315794, nativeWeightsGB: 510.286023,
    nativeFormat: "FP4 experts + FP8/BF16/FP32 · mixed", weightBits: 8,
    layers: 40, hiddenWidth: 5120, maxContextTokens: 1048576, kvWidth: 512,
    activeBillion: { decode: 16, prefill: 8 },
    cache: { fullLayers: 0, fullWidth: 0, compressedBytesPerToken: 890,
      stateBytes: 40 * 128 * (512 + 512 / 32) + 3 * 2 * 2 * 512 * 4 },
    cacheLabel: "CSA2 · shared latent width 512 · FP4 global cache 890 bytes/token + window/state allowance",
    notes: "552B backbone + 196B sparse Engram + auxiliary checkpoint tensors; 763B is HF checkpoint metadata, not dense work. Causal encoder/decoder: 8B active prefill, 16B decode. Cache assumes optimized packed storage; the readable reference runtime can allocate larger BF16 buffers. DSpark, vision, replay, routing and Engram lookup costs are excluded.",
  },
  {
    id: "qwen3-30b-a3b", name: "Qwen3-30B-A3B", repository: "Qwen/Qwen3-30B-A3B",
    revision: "ad44e777bcd18fa416d9da3bd8f70d33ebb85d39",
    paramsBillion: 30.532122624, nativeWeightsGB: 61.064245248, nativeFormat: "BF16", weightBits: 16,
    layers: 48, hiddenWidth: 2048, maxContextTokens: 40960, kvWidth: 512,
    activeBillion: { decode: 3.3, prefill: 3.3 },
    cache: { fullLayers: 48, fullWidth: 512 }, cacheLabel: "GQA · 48 layers · 4 KV heads × 128 = width 512 each",
    notes: "128 experts, eight selected/token; 3.3B active is rounded from the model card. All experts remain resident. Batch expert union and routing costs are excluded.",
  },
  {
    id: "gpt-oss-120b", name: "GPT-OSS-120B", repository: "openai/gpt-oss-120b",
    revision: "b5c939de8f754692c1647ca79fbf85e8c1e70f8a",
    paramsBillion: 116.829156672, nativeWeightsGB: 65.248815744,
    nativeFormat: "MXFP4 experts + BF16 · mixed", weightBits: 4, layers: 36, hiddenWidth: 2880, maxContextTokens: 131072, kvWidth: 512,
    activeBillion: { decode: 5.1, prefill: 5.1 },
    cache: { fullLayers: 18, fullWidth: 512, slidingLayers: 18, slidingWidth: 512, window: 128 },
    cacheLabel: "GQA · width 512 each · 18 full + 18 sliding layers (128-token window)",
    notes: "Four of 128 experts/token; 5.1B active is rounded from the card. Released MXFP4 excludes attention, routers, embeddings and output head. Uniform Q4 is not this mixed checkpoint.",
  },
  {
    id: "gemma4-31b", name: "Gemma 4 31B IT", repository: "google/gemma-4-31B-it",
    revision: "842da3794eaa0b77d5f08bae87a17459d91ff475",
    paramsBillion: 31.273088876, nativeWeightsGB: 62.546177752, nativeFormat: "BF16", weightBits: 16,
    layers: 60, hiddenWidth: 5376, maxContextTokens: 262144, kvWidth: 2048,
    cache: { fullLayers: 10, fullWidth: 2048, slidingLayers: 50, slidingWidth: 4096, window: 1024 },
    activeBillion: { decode: 31.273088876, prefill: 31.273088876 },
    cacheLabel: "10 global layers: width 2,048 · 50 local: width 4,096 · window 1,024",
    notes: "Global KV heads 4 × 512; local 16 × 256. K=V shares projections, but this conservative BF16 cache keeps both runtime buffers. Dense work includes vision weights; image compute is excluded. Gemma license applies (open weights, not unrestricted open source).",
  },
  {
    id: "mistral-small4", name: "Mistral Small 4 · 119B A6.5B", repository: "mistralai/Mistral-Small-4-119B-2603",
    revision: "a11f36bebf709121056b1dbcc943d1c6afbe494d",
    paramsBillion: 119.401317952, nativeWeightsGB: 120.92277056,
    nativeFormat: "FP8 + BF16 exclusions · mixed", weightBits: 8, layers: 36, hiddenWidth: 4096, maxContextTokens: 1048576, kvWidth: 320,
    activeBillion: { decode: 6.5, prefill: 6.5 },
    cache: { fullLayers: 36, fullWidth: 320, copies: 1 },
    cacheLabel: "MLA · single BF16 latent: rank 256 + rotary width 64 = 320 per layer",
    notes: "128 routed experts, four selected plus one shared; 6.5B active from card. Cache assumes an MLA-aware runtime, not expanded GQA. FP8 excludes vision/projector/output head; speculative decoding and image compute are excluded.",
  },
];

export function getModelPreset(id?: string): ModelPreset | undefined {
  return MODEL_PRESETS.find(model => model.id === id);
}
export function presetKVGB(model: ModelPreset, context: number, batch: number): number {
  const cache = model.cache;
  const values = cache.fullLayers * cache.fullWidth * context +
    (cache.slidingLayers ?? 0) * (cache.slidingWidth ?? 0) * Math.min(context, cache.window ?? context);
  return (values * (cache.copies ?? 2) * 2 + (cache.stateBytes ?? 0) +
    (cache.compressedBytesPerToken ?? 0) * context) * batch / 1e9;
}
