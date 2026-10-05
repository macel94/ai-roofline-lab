import { validateScenario, type ScenarioInput } from "./model";
import type { ArchitectureProfile } from "../data/profiles";

export type UnitKind = "cpu" | "gpu" | "tpu" | "npu" | "lpu";
export type Resource = "capacity" | "memory" | "host" | "bus" | "compute" | "network";
export interface ChipArchitecture {
  kind: UnitKind;
  mathTFLOPS: number;
  mathEvidence: string;
  busGBs: number | null;
  busLabel: string;
  sharedMemory: boolean;
}
// Effective BF16-equivalent teaching ceilings, not an incompatible TOPS leaderboard.
export const CHIP_ARCHITECTURES: Readonly<Record<string, ChipArchitecture>> = {
  "m4-max": { kind: "gpu", mathTFLOPS: 20, mathEvidence: "Assumed effective matrix ceiling; not an Apple specification", busGBs: null, busLabel: "Shared SoC fabric · no PCIe copy", sharedMemory: true },
  "m5-pro": { kind: "gpu", mathTFLOPS: 15, mathEvidence: "Assumed effective matrix ceiling; not an Apple specification", busGBs: null, busLabel: "Shared SoC fabric · no PCIe copy", sharedMemory: true },
  "m5-max": { kind: "gpu", mathTFLOPS: 30, mathEvidence: "Assumed effective matrix ceiling; not an Apple specification", busGBs: null, busLabel: "Shared SoC fabric · no PCIe copy", sharedMemory: true },
  "lion-cove": { kind: "cpu", mathTFLOPS: 2, mathEvidence: "Assumed effective vector ceiling; SKU/kernel dependent", busGBs: null, busLabel: "DDR controller → cache hierarchy", sharedMemory: true },
  "zen-5": { kind: "cpu", mathTFLOPS: 4, mathEvidence: "Assumed effective vector ceiling; SKU/kernel dependent", busGBs: null, busLabel: "I/O die → fabric → core chiplets", sharedMemory: true },
  "blackwell-b200": { kind: "gpu", mathTFLOPS: 2250, mathEvidence: "Assumed dense BF16 matrix ceiling; editable, not the cited FP4 peak", busGBs: 64, busLabel: "PCIe 5 ×16 · assumed 64 GB/s one-way", sharedMemory: false },
  "tpu-v6e": { kind: "tpu", mathTFLOPS: 918, mathEvidence: "Vendor peak BF16 per chip · discounted by efficiency", busGBs: null, busLabel: "Host loading not modeled · no PCIe offload assumption", sharedMemory: false },
  "groq-lpu": { kind: "lpu", mathTFLOPS: 100, mathEvidence: "Assumed effective matrix ceiling; not a Groq specification", busGBs: null, busLabel: "Compiler-scheduled streaming", sharedMemory: false },
  "m4-npu": { kind: "npu", mathTFLOPS: 8, mathEvidence: "Assumed BF16-equivalent rate; NOT the Neural Engine TOPS claim", busGBs: null, busLabel: "Shared SoC fabric · no PCIe copy", sharedMemory: true },
};

export interface ClusterInput extends ScenarioInput {
  unitsMode: "auto" | "manual";
  units: number;
  networkGbps: number; // zero explicitly disconnects multi-unit execution
  networkLatencyUs: number;
  offload: boolean;
  efficiency: number;
  targetTokensPerSecond: number;
  layers: number;
  hiddenWidth: number;
  kvRatio: number;
  activeFraction: number;
}
export interface ChipOverride { mathTFLOPS?: number; capacityGB?: number }
export interface StageTime { resource: Exclude<Resource, "capacity">; ms: number }
export interface ArchitectureResult {
  profileId: string;
  architecture: ChipArchitecture;
  capacityGB: number | null;
  weightsGB: number;
  kvGB: number;
  workingSetGB: number;
  minimumUnits: number | null;
  units: number;
  capacityFraction: number | null;
  spillGB: number;
  stages: readonly StageTime[];
  stepMs: number | null;
  tokensPerSecond: number | null;
  aggregateTokensPerSecond: number | null;
  bottleneck: Resource | "unknown";
  blockedReason: string | null;
  loadMs: number | null;
  targetUnits: number | null;
  targetStatus: "reached" | "not-reached" | "unknown";
}
export const MAX_UNITS = 1024;

export function estimateShape(paramsBillion: number): { layers: number; hiddenWidth: number } {
  const layers = Math.round(32 * (paramsBillion / 7) ** 0.25);
  return { layers, hiddenWidth: Math.round(Math.sqrt(paramsBillion * 1e9 / (12 * layers))) };
}

export function validateCluster(input: ClusterInput): string | null {
  const base = validateScenario(input);
  if (base) return base;
  const ranges: [number, number, number, string, boolean][] = [
    [input.units, 1, MAX_UNITS, "Units", true],
    [input.networkGbps, 0, 14400, "Network bandwidth (Gbit/s)", false],
    [input.networkLatencyUs, 0, 1000, "Network latency (µs)", false],
    [input.efficiency, 0.05, 1, "Efficiency", false],
    [input.targetTokensPerSecond, 0.1, 10000, "Target tokens/s", false],
    [input.layers, 1, 512, "Layers", true],
    [input.hiddenWidth, 128, 65536, "Hidden width", true],
    [input.kvRatio, 1 / 128, 1, "KV width ratio", false],
    [input.activeFraction, 0.01, 1, "Active parameter fraction", false],
  ];
  for (const [value, min, max, name, integer] of ranges) {
    if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value)))
      return `${name} must be ${integer ? "an integer " : ""}between ${min} and ${max}.`;
  }
  if (!["auto", "manual"].includes(input.unitsMode)) return "Invalid unit-count mode.";
  if (typeof input.offload !== "boolean") return "Invalid offload mode.";
  return null;
}

export function calculateArchitecture(
  input: ClusterInput, profile: ArchitectureProfile, override: ChipOverride = {},
): ArchitectureResult {
  const error = validateCluster(input);
  if (error) throw new RangeError(error);
  for (const [name, value] of Object.entries(override)) {
    if (value !== undefined && (!Number.isFinite(value) || value <= 0)) throw new RangeError(`${name} must be positive and finite.`);
  }
  const original = CHIP_ARCHITECTURES[profile.id];
  if (!original) throw new RangeError(`No physical architecture for ${profile.id}.`);
  const architecture = { ...original, mathTFLOPS: override.mathTFLOPS ?? original.mathTFLOPS,
    mathEvidence: override.mathTFLOPS === undefined ? original.mathEvidence : "User-supplied effective matrix ceiling" };
  if (profile.bandwidthGBs !== null && (!Number.isFinite(profile.bandwidthGBs) || profile.bandwidthGBs <= 0))
    throw new RangeError("Memory bandwidth must be positive and finite, or unknown.");
  const capacityGB = override.capacityGB ?? (profile.capacityMode === "unknown" ? null : profile.capacityMode === "host" ? input.hostRamGB : profile.capacityGB);
  if (capacityGB !== null && (!Number.isFinite(capacityGB) || capacityGB <= 0))
    throw new RangeError("Memory capacity must be positive and finite, or unknown.");
  const weightsGB = input.modelParamsBillion * input.weightBits / 8;
  const kvGB = 2 * input.layers * input.hiddenWidth * input.kvRatio * 2 * input.contextTokens * input.batch / 1e9;
  const workingSetGB = weightsGB * 1.2 + kvGB;
  const minimumUnits = capacityGB === null ? null : Math.max(1, Math.ceil(workingSetGB / capacityGB));
  const units = input.unitsMode === "auto" ? Math.min(MAX_UNITS, minimumUnits ?? 1) : input.units;

  function atCount(n: number): Omit<ArchitectureResult, "targetUnits" | "targetStatus"> {
    const spillGB = capacityGB === null ? 0 : Math.max(0, workingSetGB / n - capacityGB);
    let blockedReason: string | null = null;
    let bottleneck: ArchitectureResult["bottleneck"] = "unknown";
    if (capacityGB === null) blockedReason = "Usable memory capacity is unpublished. Supply an assumption to size this system.";
    else if (spillGB > 0) {
      if (!input.offload || architecture.busGBs === null || architecture.sharedMemory)
        blockedReason = `Memory capacity exceeded. Need at least ${minimumUnits} independent memory domains; this path cannot use modeled host offload.`;
      else if ((weightsGB * 0.2 + kvGB) / n > capacityGB!) blockedReason = "KV/workspace must remain in local memory; this weight-only offload path cannot fit it. Add units.";
      else if (spillGB > input.hostRamGB) blockedReason = "Host RAM cannot hold the per-unit spill; add units or host RAM.";
      bottleneck = "capacity";
    }
    if (n > 1 && input.networkGbps === 0) {
      if (!blockedReason) { blockedReason = "Network disconnected: sharded execution requires communication between units."; bottleneck = "network"; }
    }
    const activeWeightsGB = weightsGB * input.activeFraction;
    const tokens = input.phase === "decode" ? 1 : input.contextTokens;
    const operationsGFLOP = 2 * input.modelParamsBillion * input.activeFraction * input.batch * tokens;
    // Evict weights first; KV/workspace remain local. Charge actual active spilled weight bytes.
    const streamedGB = Math.min(weightsGB / n, spillGB) * input.activeFraction;
    const memoryMs = profile.bandwidthGBs === null ? 0 : (activeWeightsGB + kvGB) / n / (profile.bandwidthGBs * input.efficiency) * 1000;
    const hostMs = streamedGB / (102.4 * input.efficiency) * 1000;
    const busMs = architecture.busGBs === null ? 0 : streamedGB / (architecture.busGBs * input.efficiency) * 1000;
    const computeMs = operationsGFLOP / (n * architecture.mathTFLOPS * input.efficiency);
    const activationGB = input.batch * tokens * input.hiddenWidth * 2 / 1e9;
    const networkMs = n === 1 || input.networkGbps === 0 ? 0 : 2 * input.layers * (
      2 * (n - 1) / n * activationGB / (input.networkGbps / 8 * input.efficiency) * 1000 +
      2 * (n - 1) * input.networkLatencyUs / 1000
    );
    const stages: StageTime[] = [
      { resource: "memory", ms: memoryMs }, { resource: "host", ms: hostMs },
      { resource: "bus", ms: busMs }, { resource: "compute", ms: computeMs }, { resource: "network", ms: networkMs },
    ];
    const local = stages.filter(stage => stage.resource !== "network").reduce((a, b) => a.ms >= b.ms ? a : b);
    if (profile.bandwidthGBs === null && !blockedReason) blockedReason = "Memory bandwidth is unknown; runtime cannot be estimated.";
    if (!blockedReason) bottleneck = networkMs > local.ms ? "network" : local.resource;
    const stepMs = blockedReason ? null : local.ms + networkMs;
    const rate = stepMs === null ? null : tokens * 1000 / stepMs;
    return {
      profileId: profile.id, architecture, capacityGB, weightsGB, kvGB, workingSetGB, minimumUnits,
      units: n, capacityFraction: capacityGB === null ? null : workingSetGB / (n * capacityGB),
      spillGB, stages, stepMs, tokensPerSecond: rate,
      aggregateTokensPerSecond: rate === null ? null : rate * input.batch,
      bottleneck, blockedReason,
      loadMs: architecture.busGBs === null ? null : weightsGB / (n * architecture.busGBs * input.efficiency) * 1000,
    };
  }
  let targetUnits: number | null = null;
  if (minimumUnits !== null && profile.bandwidthGBs !== null) {
    for (let n = 1; n <= MAX_UNITS; n++) {
      const candidate = atCount(n);
      if (candidate.tokensPerSecond !== null && candidate.tokensPerSecond >= input.targetTokensPerSecond) {
        targetUnits = n;
        break;
      }
    }
  }
  return { ...atCount(units), targetUnits,
    targetStatus: minimumUnits === null || profile.bandwidthGBs === null ? "unknown" : targetUnits === null ? "not-reached" : "reached" };
}
