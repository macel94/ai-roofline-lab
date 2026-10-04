export type WorkloadPhase = "decode" | "prefill";
export type Bottleneck = "memory" | "compute" | "balanced" | "unknown";
export type FitStatus = "fits" | "does-not-fit" | "unknown";
export type CapacityMode = "fixed" | "host" | "unknown";

export interface CalculationProfile {
  readonly id: string;
  readonly bandwidthGBs: number | null;
  readonly capacityGB: number | null;
  readonly capacityMode: CapacityMode;
}

export interface ScenarioInput {
  readonly phase: WorkloadPhase;
  readonly modelParamsBillion: number;
  readonly weightBits: 4 | 8 | 16;
  readonly batch: number;
  readonly contextTokens: number;
  readonly computeCeilingTFLOPS: number;
  readonly hostRamGB: number;
}

export interface ScenarioResult {
  readonly profileId: string;
  readonly weightFootprintGB: number;
  readonly estimatedWorkingSetGB: number;
  readonly availableCapacityGB: number | null;
  readonly fit: FitStatus;
  readonly tokensPerStep: number;
  readonly operationsGFLOP: number;
  readonly intensityFLOPPerByte: number;
  readonly memoryCeilingTFLOPS: number | null;
  readonly computeCeilingTFLOPS: number;
  readonly attainableTFLOPS: number | null;
  readonly ridgeIntensityFLOPPerByte: number | null;
  readonly bottleneck: Bottleneck;
}

export const MEMORY_RESERVE_FACTOR = 1.2;
export const BALANCED_TOLERANCE = 0.05;
export const MIN_COMPUTE_CEILING_TFLOPS = 10;
export const MAX_COMPUTE_CEILING_TFLOPS = 10_000;

export function validateScenario(input: ScenarioInput): string | null {
  if (!Number.isFinite(input.modelParamsBillion) || input.modelParamsBillion <= 0) {
    return "La dimensione del modello deve essere un numero positivo.";
  }

  if (![4, 8, 16].includes(input.weightBits)) {
    return "La precisione dei pesi non è supportata da questo modello didattico.";
  }

  if (!Number.isInteger(input.batch) || input.batch < 1 || input.batch > 32) {
    return "Il batch deve essere un intero tra 1 e 32.";
  }

  if (
    !Number.isInteger(input.contextTokens) ||
    input.contextTokens < 128 ||
    input.contextTokens > 8192
  ) {
    return "Il contesto deve essere compreso tra 128 e 8.192 token.";
  }

  if (
    !Number.isFinite(input.computeCeilingTFLOPS) ||
    input.computeCeilingTFLOPS < MIN_COMPUTE_CEILING_TFLOPS ||
    input.computeCeilingTFLOPS > MAX_COMPUTE_CEILING_TFLOPS
  ) {
    return `Il tetto compute deve essere tra ${MIN_COMPUTE_CEILING_TFLOPS} e ${MAX_COMPUTE_CEILING_TFLOPS} TFLOP/s.`;
  }

  if (!Number.isFinite(input.hostRamGB) || input.hostRamGB < 16 || input.hostRamGB > 512) {
    return "La RAM host deve essere tra 16 e 512 GB.";
  }

  if (input.phase !== "decode" && input.phase !== "prefill") {
    return "La fase del workload non è valida.";
  }

  return null;
}

export function calculateScenario(
  input: ScenarioInput,
  profile: CalculationProfile,
): ScenarioResult {
  const validationError = validateScenario(input);
  if (validationError) {
    throw new RangeError(validationError);
  }

  const weightFootprintGB = (input.modelParamsBillion * input.weightBits) / 8;
  const estimatedWorkingSetGB = weightFootprintGB * MEMORY_RESERVE_FACTOR;
  const availableCapacityGB = resolveCapacity(profile, input.hostRamGB);
  const fit: FitStatus =
    availableCapacityGB === null
      ? "unknown"
      : estimatedWorkingSetGB <= availableCapacityGB
        ? "fits"
        : "does-not-fit";

  const tokensPerStep = input.phase === "decode" ? 1 : input.contextTokens;
  const operationsGFLOP =
    2 * input.modelParamsBillion * input.batch * tokensPerStep;
  const intensityFLOPPerByte = operationsGFLOP / weightFootprintGB;
  const memoryCeilingTFLOPS =
    profile.bandwidthGBs === null
      ? null
      : (profile.bandwidthGBs * intensityFLOPPerByte) / 1000;
  const computeCeilingTFLOPS = input.computeCeilingTFLOPS;
  const attainableTFLOPS =
    memoryCeilingTFLOPS === null
      ? null
      : Math.min(computeCeilingTFLOPS, memoryCeilingTFLOPS);
  const ridgeIntensityFLOPPerByte =
    profile.bandwidthGBs === null
      ? null
      : (computeCeilingTFLOPS * 1000) / profile.bandwidthGBs;
  const bottleneck = classifyBottleneck(memoryCeilingTFLOPS, computeCeilingTFLOPS);

  return {
    profileId: profile.id,
    weightFootprintGB,
    estimatedWorkingSetGB,
    availableCapacityGB,
    fit,
    tokensPerStep,
    operationsGFLOP,
    intensityFLOPPerByte,
    memoryCeilingTFLOPS,
    computeCeilingTFLOPS,
    attainableTFLOPS,
    ridgeIntensityFLOPPerByte,
    bottleneck,
  };
}

function resolveCapacity(profile: CalculationProfile, hostRamGB: number): number | null {
  if (profile.capacityMode === "unknown") {
    return null;
  }

  if (profile.capacityMode === "host") {
    return hostRamGB;
  }

  return profile.capacityGB;
}

function classifyBottleneck(
  memoryCeilingTFLOPS: number | null,
  computeCeilingTFLOPS: number,
): Bottleneck {
  if (memoryCeilingTFLOPS === null || !Number.isFinite(memoryCeilingTFLOPS)) {
    return "unknown";
  }

  if (memoryCeilingTFLOPS < computeCeilingTFLOPS * (1 - BALANCED_TOLERANCE)) {
    return "memory";
  }

  if (memoryCeilingTFLOPS > computeCeilingTFLOPS * (1 + BALANCED_TOLERANCE)) {
    return "compute";
  }

  return "balanced";
}

export function calculateIntensity(
  phase: WorkloadPhase,
  batch: number,
  contextTokens: number,
  weightBits: 4 | 8 | 16,
): number {
  const tokensPerStep = phase === "decode" ? 1 : contextTokens;
  return (16 * batch * tokensPerStep) / weightBits;
}
